import { describe, expect, it } from "vitest";
import type { ScheduleSpec } from "@/api/types";
import dayjs from "./dayjs";
import {
  defaultScheduleFormValues,
  formatLocalDateTime,
  formValuesToSpec,
  isFutureInZone,
  normalizeSpec,
  parseLocalDateTime,
  parseLocalTime,
  specToFormValues,
  todayInZone,
} from "./scheduleForm";

describe("parsing backend date/time strings", () => {
  it("parses local date-times with or without seconds (and fractions)", () => {
    expect(parseLocalDateTime("2026-11-18T09:59:29")?.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-11-18 09:59:29");
    expect(parseLocalDateTime("2026-11-18T15:30")?.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-11-18 15:30:00");
    expect(parseLocalDateTime("2026-11-18T15:30:00.123456")?.format("HH:mm:ss")).toBe("15:30:00");
  });

  it("rejects malformed or overflowing date-times", () => {
    expect(parseLocalDateTime("")).toBeNull();
    expect(parseLocalDateTime(null)).toBeNull();
    expect(parseLocalDateTime("2026-02-31T10:00")).toBeNull();
    expect(parseLocalDateTime("2026-11-18T15:30:00Z")).toBeNull();
  });

  it("parses times as HH:mm or HH:mm:ss", () => {
    expect(parseLocalTime("09:30:00")?.format("HH:mm")).toBe("09:30");
    expect(parseLocalTime("9:05")?.format("HH:mm")).toBe("09:05");
    expect(parseLocalTime("24:00")).toBeNull();
    expect(parseLocalTime("noon")).toBeNull();
  });

  it("formats with zeroed seconds", () => {
    expect(formatLocalDateTime(dayjs("2026-11-18T15:30:45"))).toBe("2026-11-18T15:30:00");
  });
});

describe("spec ↔ form values", () => {
  const roundTrips: [string, ScheduleSpec, ScheduleSpec][] = [
    [
      "ONE_TIME",
      { type: "ONE_TIME", runAt: "2026-11-18T09:59:29", timeZone: "UTC" },
      { type: "ONE_TIME", runAt: "2026-11-18T09:59:00", timeZone: "UTC" },
    ],
    [
      "INTERVAL",
      { type: "INTERVAL", every: 2, unit: "HOURS", timeZone: "Europe/London" },
      { type: "INTERVAL", every: 2, unit: "HOURS", timeZone: "Europe/London" },
    ],
    [
      "WEEKLY",
      { type: "WEEKLY", daysOfWeek: ["FRIDAY", "MONDAY"], time: "09:30:00", timeZone: "Asia/Jerusalem" },
      { type: "WEEKLY", daysOfWeek: ["MONDAY", "FRIDAY"], time: "09:30", timeZone: "Asia/Jerusalem" },
    ],
    [
      "CRON",
      { type: "CRON", expression: "0 0 9 ? * MON-FRI", timeZone: "UTC" },
      { type: "CRON", expression: "0 0 9 ? * MON-FRI", timeZone: "UTC" },
    ],
  ];

  it.each(roundTrips)("%s round-trips through the form representation", (_, spec, expected) => {
    const values = specToFormValues(spec);
    expect(values.type).toBe(spec.type);
    expect(values.timeZone).toBe(spec.timeZone);
    expect(formValuesToSpec(values)).toEqual(expected);
  });

  it("pre-fills dayjs values for the pickers", () => {
    const oneTime = specToFormValues({ type: "ONE_TIME", runAt: "2026-11-18T15:30", timeZone: "UTC" });
    expect(dayjs.isDayjs(oneTime.runAt)).toBe(true);
    expect(oneTime.runAt?.format("YYYY-MM-DD HH:mm")).toBe("2026-11-18 15:30");

    const weekly = specToFormValues({ type: "WEEKLY", daysOfWeek: ["MONDAY"], time: "07:45:00", timeZone: "UTC" });
    expect(weekly.time?.format("HH:mm")).toBe("07:45");
  });

  it("keeps defaults for the other types so switching types is painless", () => {
    const values = specToFormValues({ type: "CRON", expression: "0 * * * * ?", timeZone: "UTC" });
    expect(values.every).toBe(15);
    expect(values.unit).toBe("MINUTES");
    expect(values.daysOfWeek).toEqual(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]);
    expect(values.time?.format("HH:mm")).toBe("09:00");
  });

  it("only sends the active type's fields", () => {
    const values = { ...defaultScheduleFormValues("UTC"), type: "CRON" as const, expression: "  0  0 12 * * ?  " };
    expect(formValuesToSpec(values)).toEqual({ type: "CRON", expression: "0 0 12 * * ?", timeZone: "UTC" });
  });

  it("returns null for incomplete values", () => {
    const defaults = defaultScheduleFormValues("UTC");
    expect(formValuesToSpec(undefined)).toBeNull();
    expect(formValuesToSpec({ ...defaults, timeZone: "" })).toBeNull();
    expect(formValuesToSpec({ ...defaults, type: "ONE_TIME", runAt: null })).toBeNull();
    expect(formValuesToSpec({ ...defaults, type: "INTERVAL", every: null })).toBeNull();
    expect(formValuesToSpec({ ...defaults, type: "WEEKLY", daysOfWeek: [] })).toBeNull();
    expect(formValuesToSpec({ ...defaults, type: "WEEKLY", time: null })).toBeNull();
    expect(formValuesToSpec({ ...defaults, type: "CRON", expression: "   " })).toBeNull();
  });
});

describe("normalizeSpec", () => {
  it("cleans up backend formats before re-sending", () => {
    expect(
      normalizeSpec({ type: "WEEKLY", daysOfWeek: ["SUNDAY", "MONDAY"], time: "09:30:00", timeZone: "UTC" }),
    ).toEqual({ type: "WEEKLY", daysOfWeek: ["MONDAY", "SUNDAY"], time: "09:30", timeZone: "UTC" });
    expect(normalizeSpec({ type: "ONE_TIME", runAt: "2026-11-18T09:59", timeZone: "UTC" })).toEqual({
      type: "ONE_TIME",
      runAt: "2026-11-18T09:59:00",
      timeZone: "UTC",
    });
    const cron: ScheduleSpec = { type: "CRON", expression: "0 * * * * ?", timeZone: "UTC" };
    expect(normalizeSpec(cron)).toBe(cron);
  });
});

describe("time zone helpers", () => {
  const now = dayjs("2026-11-18T12:00:00Z");

  it("compares wall-clock times in the selected zone", () => {
    // 13:30 in Jerusalem (UTC+2) is 11:30Z: already past at 12:00Z.
    expect(isFutureInZone(dayjs("2026-11-18T13:30:00"), "Asia/Jerusalem", now)).toBe(false);
    // 13:30 in UTC is still ahead.
    expect(isFutureInZone(dayjs("2026-11-18T13:30:00"), "UTC", now)).toBe(true);
  });

  it("knows today's date in a zone", () => {
    expect(todayInZone("UTC", dayjs("2026-11-18T23:30:00Z"))).toBe("2026-11-18");
    expect(todayInZone("Asia/Tokyo", dayjs("2026-11-18T23:30:00Z"))).toBe("2026-11-19");
  });
});
