import { describe, expect, it } from "vitest";
import { describeCron, describeDays, describeInterval, describeSchedule } from "./describeSchedule";

describe("describeSchedule", () => {
  describe("ONE_TIME", () => {
    it("describes the wall-clock time and zone", () => {
      expect(describeSchedule({ type: "ONE_TIME", runAt: "2026-11-18T15:30:00", timeZone: "Asia/Jerusalem" })).toBe(
        "Once on Nov 18, 2026 15:30 (Asia/Jerusalem)",
      );
    });

    it("accepts runAt with or without seconds, as returned by the backend", () => {
      expect(describeSchedule({ type: "ONE_TIME", runAt: "2026-11-18T15:30", timeZone: "UTC" })).toBe(
        "Once on Nov 18, 2026 15:30 (UTC)",
      );
      expect(describeSchedule({ type: "ONE_TIME", runAt: "2026-11-18T09:59:29", timeZone: "UTC" })).toBe(
        "Once on Nov 18, 2026 09:59 (UTC)",
      );
    });

    it("falls back to the raw value when it can't be parsed", () => {
      expect(describeSchedule({ type: "ONE_TIME", runAt: "tomorrow", timeZone: "UTC" })).toBe("Once on tomorrow (UTC)");
    });
  });

  describe("INTERVAL", () => {
    it.each([
      [15, "MINUTES", "Every 15 minutes"],
      [1, "MINUTES", "Every minute"],
      [1, "HOURS", "Every hour"],
      [6, "HOURS", "Every 6 hours"],
      [2, "DAYS", "Every 2 days"],
    ] as const)("every %i %s → %s", (every, unit, expected) => {
      expect(describeSchedule({ type: "INTERVAL", every, unit, timeZone: "UTC" })).toBe(expected);
      expect(describeInterval(every, unit)).toBe(expected);
    });
  });

  describe("WEEKLY", () => {
    it("lists days in week order and normalizes HH:mm:ss", () => {
      expect(
        describeSchedule({
          type: "WEEKLY",
          daysOfWeek: ["WEDNESDAY", "MONDAY"],
          time: "09:30:00",
          timeZone: "Asia/Jerusalem",
        }),
      ).toBe("Every Mon, Wed at 09:30 (Asia/Jerusalem)");
    });

    it("names common day sets", () => {
      expect(describeDays(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"])).toBe("Every weekday");
      expect(describeDays(["SUNDAY", "SATURDAY"])).toBe("Every weekend");
      expect(
        describeSchedule({
          type: "WEEKLY",
          daysOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
          time: "07:05",
          timeZone: "UTC",
        }),
      ).toBe("Every day at 07:05 (UTC)");
    });
  });

  describe("CRON", () => {
    it("uses cronstrue with a 24-hour clock", () => {
      expect(describeSchedule({ type: "CRON", expression: "0 0 9 ? * MON-FRI", timeZone: "UTC" })).toBe(
        "At 09:00, Monday through Friday (UTC)",
      );
      expect(describeSchedule({ type: "CRON", expression: "0 0/15 * * * ?", timeZone: "Europe/London" })).toBe(
        "Every 15 minutes (Europe/London)",
      );
    });

    it("falls back to the raw expression when it can't be described", () => {
      expect(describeSchedule({ type: "CRON", expression: "not a cron", timeZone: "UTC" })).toBe("not a cron");
    });
  });

  it("describeCron returns null for blank or invalid expressions", () => {
    expect(describeCron("   ")).toBeNull();
    expect(describeCron("nope")).toBeNull();
    expect(describeCron("0 0 0 1 * ?")).toBe("At 00:00, on day 1 of the month");
  });
});
