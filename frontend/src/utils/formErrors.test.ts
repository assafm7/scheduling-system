import { describe, expect, it } from "vitest";
import { errorSentence, fieldLabel, mapFieldErrors, toFieldPath } from "./formErrors";

describe("toFieldPath", () => {
  it.each([
    ["name", ["name"]],
    ["parameters.message", ["parameters", "message"]],
    ["schedule.expression", ["schedule", "expression"]],
    ["schedule.daysOfWeek[0]", ["schedule", "daysOfWeek"]],
    ["schedule", ["schedule", "type"]],
  ])("%s → %j", (key, path) => {
    expect(toFieldPath(key)).toEqual(path);
  });
});

describe("fieldLabel / errorSentence", () => {
  it("labels top-level, schedule and parameter fields", () => {
    expect(fieldLabel("name")).toBe("Name");
    expect(fieldLabel("taskKey")).toBe("Task");
    expect(fieldLabel("schedule.expression")).toBe("Cron expression");
    expect(fieldLabel("schedule.daysOfWeek[1]")).toBe("Days");
    expect(fieldLabel("parameters.message", { message: "Message" })).toBe("Message");
    expect(fieldLabel("parameters.extra")).toBe("Parameter “extra”");
    expect(fieldLabel("")).toBe("Request");
  });

  it("turns fragments into sentences and leaves full sentences alone", () => {
    expect(errorSentence("schedule.expression", "must not fire more often than once a minute")).toBe(
      "Cron expression must not fire more often than once a minute",
    );
    expect(errorSentence("name", "A scheduling with this name already exists")).toBe(
      "A scheduling with this name already exists",
    );
  });
});

describe("mapFieldErrors", () => {
  const registered = [["name"], ["taskKey"], ["parameters", "message"], ["schedule", "expression"], ["schedule", "timeZone"]];

  it("maps known fields and reports the rest, as readable sentences", () => {
    const result = mapFieldErrors(
      {
        name: "must not be blank",
        "parameters.message": "is required",
        "schedule.expression": "is not a valid Quartz cron expression",
        "parameters.unknown": "is not a parameter of this task",
        "": "Something else went wrong.",
      },
      registered,
      { message: "Message" },
    );
    expect(result.fields).toEqual([
      { name: ["name"], errors: ["Name must not be blank"] },
      { name: ["parameters", "message"], errors: ["Message is required"] },
      { name: ["schedule", "expression"], errors: ["Cron expression is not a valid Quartz cron expression"] },
    ]);
    expect(result.unmapped).toEqual([
      { key: "parameters.unknown", message: "Parameter “unknown” is not a parameter of this task" },
      { key: "", message: "Something else went wrong." },
    ]);
  });
});
