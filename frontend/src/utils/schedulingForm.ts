import type {
  ParameterDefinition,
  ParameterValue,
  SchedulingRequest,
  SchedulingResponse,
  TaskDefinition,
} from "@/api/types";
import {
  defaultScheduleFormValues,
  formValuesToSpec,
  normalizeSpec,
  specToFormValues,
  type ScheduleFormValues,
} from "./scheduleForm";

export type ParameterFormValue = ParameterValue | null | undefined;

export interface SchedulingFormValues {
  name?: string;
  description?: string | null;
  taskKey?: string;
  enabled: boolean;
  parameters?: Record<string, ParameterFormValue>;
  schedule: ScheduleFormValues;
}

export function newSchedulingFormValues(timeZone: string): SchedulingFormValues {
  return {
    name: "",
    description: "",
    taskKey: undefined,
    enabled: true,
    parameters: {},
    schedule: defaultScheduleFormValues(timeZone),
  };
}

export function schedulingToFormValues(scheduling: SchedulingResponse): SchedulingFormValues {
  return {
    name: scheduling.name,
    description: scheduling.description ?? "",
    taskKey: scheduling.taskKey,
    enabled: scheduling.enabled,
    parameters: { ...scheduling.parameters },
    schedule: specToFormValues(scheduling.schedule),
  };
}

/** Initial parameter values when a task is picked: booleans start as an explicit `false`. */
export function initialParameterValues(task: TaskDefinition | undefined): Record<string, ParameterFormValue> {
  const values: Record<string, ParameterFormValue> = {};
  for (const parameter of task?.parameters ?? []) {
    values[parameter.name] = parameter.type === "BOOLEAN" ? false : undefined;
  }
  return values;
}

function cleanParameterValue(definition: ParameterDefinition, value: ParameterFormValue): ParameterValue | undefined {
  if (value === null || value === undefined) return undefined;
  switch (definition.type) {
    case "NUMBER":
      return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    case "BOOLEAN":
      return Boolean(value);
    case "EMAIL": {
      const email = String(value).trim();
      return email ? email : undefined;
    }
    default: {
      const text = String(value);
      return text.trim() ? text : undefined;
    }
  }
}

/** Keeps only the selected task's parameters and drops empty optional values. */
export function buildParameters(
  task: TaskDefinition | undefined,
  values: Record<string, ParameterFormValue> | undefined,
): Record<string, ParameterValue> {
  const result: Record<string, ParameterValue> = {};
  if (!task) return result;
  for (const definition of task.parameters) {
    const cleaned = cleanParameterValue(definition, values?.[definition.name]);
    if (cleaned !== undefined) result[definition.name] = cleaned;
  }
  return result;
}

/** Converts validated form values to the API request body. */
export function formValuesToRequest(
  values: SchedulingFormValues,
  task: TaskDefinition | undefined,
  version?: number,
): SchedulingRequest {
  const schedule = formValuesToSpec(values.schedule);
  if (!schedule) throw new Error("The schedule is incomplete.");
  const description = values.description?.trim();
  const request: SchedulingRequest = {
    name: (values.name ?? "").trim(),
    description: description ? description : null,
    taskKey: values.taskKey ?? "",
    parameters: buildParameters(task, values.parameters),
    schedule,
    enabled: values.enabled,
  };
  if (version !== undefined) request.version = version;
  return request;
}

/** Full PUT body for an existing scheduling with only `enabled` changed (used by the table toggle). */
export function toggleRequest(scheduling: SchedulingResponse, enabled: boolean): SchedulingRequest {
  return {
    name: scheduling.name,
    description: scheduling.description,
    taskKey: scheduling.taskKey,
    parameters: { ...scheduling.parameters },
    schedule: normalizeSpec(scheduling.schedule),
    enabled,
    version: scheduling.version,
  };
}
