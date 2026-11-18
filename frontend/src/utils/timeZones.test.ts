import { describe, expect, it } from "vitest";
import { browserTimeZone, supportedTimeZones, timeZoneOffsetLabel, timeZoneOptions } from "./timeZones";

describe("timeZones", () => {
  it("uses the runtime's zone as the browser default (UTC in tests)", () => {
    expect(browserTimeZone()).toBe("UTC");
  });

  it("lists IANA zones including UTC, sorted", () => {
    const zones = supportedTimeZones();
    expect(zones).toContain("UTC");
    expect(zones).toContain("Asia/Jerusalem");
    expect([...zones].sort((a, b) => a.localeCompare(b))).toEqual(zones);
  });

  it("labels options with their current UTC offset", () => {
    const winter = new Date("2026-01-15T12:00:00Z");
    expect(timeZoneOffsetLabel("Asia/Jerusalem", winter)).toBe("GMT+2");
    const option = timeZoneOptions(undefined, winter).find((o) => o.value === "America/New_York");
    expect(option?.label).toBe("America/New York (GMT-5)");
  });

  it("keeps an unknown stored zone selectable", () => {
    const options = timeZoneOptions("Mars/Olympus_Mons");
    expect(options[0]).toEqual({ value: "Mars/Olympus_Mons", label: "Mars/Olympus Mons" });
    expect(timeZoneOffsetLabel("Mars/Olympus_Mons")).toBe("");
  });
});
