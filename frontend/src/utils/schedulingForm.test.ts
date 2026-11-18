import { describe, expect, it } from "vitest";
import type { TaskDefinition } from "@/api/types";
import { EMAIL_TASK, LOG_TASK, makeScheduling } from "@/test/fixtures";
import {
  buildParameters,
  formValuesToRequest,
  initialParameterValues,
  newSchedulingFormValues,
  schedulingToFormValues,
  toggleRequest,
} from "./schedulingForm";

const ALL_TYPES_TASK: TaskDefinition = {
  key: "ALL",
  name: "All types",
  description: "",
  parameters: [
    { name: "text", label: "Text", type: "STRING", required: false, description: null, options: null, maxLength: null },
    { name: "count", label: "Count", type: "NUMBER", required: false, description: null, options: null, maxLength: null },
    { name: "flag", label: "Flag", type: "BOOLEAN", required: false, description: null, options: null, maxLength: null },
    { name: "mail", label: "Mail", type: "EMAIL", required: false, description: null, options: null, maxLength: null },
    { name: "choice", label: "Choice", type: "ENUM", required: false, description: null, options: ["A", "B"], maxLength: null },
  ],
};

describe("buildParameters", () => {
  it("keeps typed values of the task's parameters only", () => {
    expect(
      buildParameters(ALL_TYPES_TASK, {
        text: "hello",
        count: 3,
        flag: true,
        mail: "  a@b.co ",
        choice: "B",
        stale: "from another task",
      }),
    ).toEqual({ text: "hello", count: 3, flag: true, mail: "a@b.co", choice: "B" });
  });

  it("drops empty optional values but keeps an explicit false", () => {
    expect(
      buildParameters(ALL_TYPES_TASK, { text: "   ", count: null, flag: false, mail: "", choice: undefined }),
    ).toEqual({ flag: false });
  });

  it("returns nothing without a task", () => {
    expect(buildParameters(undefined, { text: "x" })).toEqual({});
  });
});

describe("initialParameterValues", () => {
  it("starts booleans as false and everything else empty", () => {
    expect(initialParameterValues(ALL_TYPES_TASK)).toEqual({
      text: undefined,
      count: undefined,
      flag: false,
      mail: undefined,
      choice: undefined,
    });
    expect(initialParameterValues(undefined)).toEqual({});
  });
});

describe("formValuesToRequest", () => {
  it("builds a create request with trimmed name and null description", () => {
    const values = {
      ...newSchedulingFormValues("UTC"),
      name: "  Heartbeat ",
      description: "   ",
      taskKey: "LOG",
      parameters: { message: "Hi", level: undefined },
    };
    expect(formValuesToRequest(values, LOG_TASK)).toEqual({
      name: "Heartbeat",
      description: null,
      taskKey: "LOG",
      parameters: { message: "Hi" },
      schedule: { type: "INTERVAL", every: 15, unit: "MINUTES", timeZone: "UTC" },
      enabled: true,
    });
  });

  it("includes the version for updates", () => {
    const scheduling = makeScheduling({ version: 7 });
    const request = formValuesToRequest(schedulingToFormValues(scheduling), LOG_TASK, scheduling.version);
    expect(request.version).toBe(7);
    expect(request.parameters).toEqual({ message: "Still alive", level: "INFO" });
    expect(request.description).toBe("Proves the scheduler is alive");
  });

  it("refuses an incomplete schedule", () => {
    const values = { ...newSchedulingFormValues("UTC"), name: "x", taskKey: "EMAIL" };
    values.schedule = { ...values.schedule, type: "CRON", expression: "" };
    expect(() => formValuesToRequest(values, EMAIL_TASK)).toThrow(/incomplete/);
  });
});

describe("toggleRequest", () => {
  it("re-sends the full scheduling with enabled flipped and its version", () => {
    const scheduling = makeScheduling({
      schedule: { type: "WEEKLY", daysOfWeek: ["MONDAY"], time: "09:30:00", timeZone: "UTC" },
      version: 4,
    });
    expect(toggleRequest(scheduling, false)).toEqual({
      name: scheduling.name,
      description: scheduling.description,
      taskKey: "LOG",
      parameters: { message: "Still alive", level: "INFO" },
      schedule: { type: "WEEKLY", daysOfWeek: ["MONDAY"], time: "09:30", timeZone: "UTC" },
      enabled: false,
      version: 4,
    });
  });
});
