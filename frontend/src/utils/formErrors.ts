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

/** Splits server field errors into those that match a registered form field and the rest. */
export function mapFieldErrors(
  fieldErrors: Record<string, string>,
  registeredFields: FieldPath[],
): FieldErrorMapping {
  const registered = new Set(registeredFields.map(pathKey));
  const grouped = new Map<string, MappedFieldError>();
  const unmapped: FieldErrorMapping["unmapped"] = [];

  for (const [key, message] of Object.entries(fieldErrors)) {
    const path = toFieldPath(key);
    const id = pathKey(path);
    if (path.length > 0 && registered.has(id)) {
      const entry = grouped.get(id) ?? { name: path, errors: [] };
      entry.errors.push(message);
      grouped.set(id, entry);
    } else {
      unmapped.push({ key, message });
    }
  }
  return { fields: [...grouped.values()], unmapped };
}

/** "parameters.message" → "Parameters › message", for errors shown outside the form fields. */
export function humanizeFieldKey(key: string): string {
  if (!key) return "Request";
  const [first, ...rest] = key.split(".");
  const head = first.charAt(0).toUpperCase() + first.slice(1);
  return rest.length ? `${head} › ${rest.join(".")}` : head;
}
