export type FieldPath = (string | number)[];

export interface MappedFieldError {
  name: FieldPath;
  errors: string[];
}

export interface FieldErrorMapping {
  fields: MappedFieldError[];
  /** Errors that don't correspond to a field currently rendered in the form. */
  unmapped: { key: string; message: string }[];
}

/**
 * Turns a backend error key into an antd form field path:
 * "name" → ["name"], "parameters.message" → ["parameters", "message"],
 * "schedule.daysOfWeek[0]" → ["schedule", "daysOfWeek"], "schedule" → ["schedule", "type"].
 */
export function toFieldPath(key: string): FieldPath {
  const segments = key
    .replace(/\[\d+\]/g, "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 1 && segments[0] === "schedule") return ["schedule", "type"];
  return segments;
}

const pathKey = (path: FieldPath) => path.map(String).join("\u0000");

const TOP_LEVEL_LABELS: Record<string, string> = {
  name: "Name",
  description: "Description",
  taskKey: "Task",
  enabled: "Enabled",
  parameters: "Parameters",
  schedule: "Schedule",
};

const SCHEDULE_LABELS: Record<string, string> = {
  type: "Schedule type",
  runAt: "Run time",
  every: "Interval",
  unit: "Interval unit",
  daysOfWeek: "Days",
  time: "Time",
  expression: "Cron expression",
  timeZone: "Time zone",
};

/** Human label for a backend error key; parameter labels come from the selected task's schema. */
export function fieldLabel(key: string, parameterLabels: Record<string, string> = {}): string {
  const [head = "", ...rest] = key.replace(/\[\d+\]/g, "").split(".");
  const field = rest.join(".");
  if (head === "parameters" && field) return parameterLabels[field] ?? `Parameter “${field}”`;
  if (head === "schedule" && field) return SCHEDULE_LABELS[field] ?? `Schedule ${field}`;
  return TOP_LEVEL_LABELS[head] ?? (head || "Request");
}

/**
 * Backend messages are often fragments relative to their field ("is required", "must not fire more
 * often than once a minute"). Prefix those with the field's label so they read as sentences.
 */
export function errorSentence(key: string, message: string, parameterLabels: Record<string, string> = {}): string {
  const text = message.trim();
  return /^[a-z]/.test(text) ? `${fieldLabel(key, parameterLabels)} ${text}` : text;
}

/** Splits server field errors into those that match a registered form field and the rest. */
export function mapFieldErrors(
  fieldErrors: Record<string, string>,
  registeredFields: FieldPath[],
  parameterLabels: Record<string, string> = {},
): FieldErrorMapping {
  const registered = new Set(registeredFields.map(pathKey));
  const grouped = new Map<string, MappedFieldError>();
  const unmapped: FieldErrorMapping["unmapped"] = [];

  for (const [key, message] of Object.entries(fieldErrors)) {
    const path = toFieldPath(key);
    const id = pathKey(path);
    const sentence = errorSentence(key, message, parameterLabels);
    if (path.length > 0 && registered.has(id)) {
      const entry = grouped.get(id) ?? { name: path, errors: [] };
      entry.errors.push(sentence);
      grouped.set(id, entry);
    } else {
      unmapped.push({ key, message: sentence });
    }
  }
  return { fields: [...grouped.values()], unmapped };
}
