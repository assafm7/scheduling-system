import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  type IntervalUnit,
  type ScheduleSpec,
  type ScheduleType,
} from "@/api/types";
import dayjs, { type Dayjs } from "./dayjs";

/** Form-side representation of a ScheduleSpec: dayjs objects for the pickers, one field set per type. */
export interface ScheduleFormValues {
  type: ScheduleType;
  timeZone: string;
  runAt?: Dayjs | null;
  every?: number | null;
  unit?: IntervalUnit;
  daysOfWeek?: DayOfWeek[];
  time?: Dayjs | null;
  expression?: string;
}

export const LOCAL_DATE_TIME_FORMAT = "YYYY-MM-DDTHH:mm:ss";
export const LOCAL_TIME_FORMAT = "HH:mm";
export const WEEKDAYS: readonly DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
export const WEEKEND: readonly DayOfWeek[] = ["SATURDAY", "SUNDAY"];

// Accepts "2026-11-18T15:30", "2026-11-18T15:30:00" and fractional seconds ("...:00.123456").
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
// Accepts "09:30", "9:30", "09:30:00" and fractional seconds.
const LOCAL_TIME = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
// Arbitrary fixed date for time-only values, so conversions are deterministic.
const TIME_BASE_DATE = "2000-01-03";

/** Parses an offset-less local date-time (wall-clock) into a dayjs in the browser's zone. */
export function parseLocalDateTime(value: string | null | undefined): Dayjs | null {
  const match = value ? LOCAL_DATE_TIME.exec(value.trim()) : null;
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0));
  const parsed = dayjs(new Date(year, month - 1, day, hour, minute, second));
  // Reject overflowing input such as "2026-02-31T25:00" instead of silently rolling it over.
  const roundTrips =
    parsed.isValid() &&
    parsed.year() === year &&
    parsed.month() === month - 1 &&
    parsed.date() === day &&
    parsed.hour() === hour &&
    parsed.minute() === minute;
  return roundTrips ? parsed : null;
}

/** Parses "HH:mm" or "HH:mm:ss" into a dayjs on a fixed date. */
export function parseLocalTime(value: string | null | undefined): Dayjs | null {
  const match = value ? LOCAL_TIME.exec(value.trim()) : null;
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return dayjs(`${TIME_BASE_DATE}T00:00:00`).hour(hour).minute(minute);
}

export function formatLocalDateTime(value: Dayjs): string {
  return value.second(0).millisecond(0).format(LOCAL_DATE_TIME_FORMAT);
}

export function formatLocalTime(value: Dayjs): string {
  return value.format(LOCAL_TIME_FORMAT);
}

/** Normalizes "09:30:00" to "09:30"; leaves unparseable input untouched for the server to reject. */
export function normalizeLocalTime(value: string): string {
  const parsed = parseLocalTime(value);
  return parsed ? formatLocalTime(parsed) : value;
}

export function sortDays(days: readonly DayOfWeek[]): DayOfWeek[] {
  return DAYS_OF_WEEK.filter((day) => days.includes(day));
}

export function normalizeCronExpression(expression: string): string {
  return expression.trim().replace(/\s+/g, " ");
}

/** Defaults for every type, so switching the type selector always lands on sensible values. */
export function defaultScheduleFormValues(timeZone: string): ScheduleFormValues {
  return {
    type: "INTERVAL",
    timeZone,
    runAt: null,
    every: 15,
    unit: "MINUTES",
    daysOfWeek: [...WEEKDAYS],
    time: parseLocalTime("09:00"),
    expression: "",
  };
}

export function specToFormValues(spec: ScheduleSpec): ScheduleFormValues {
  const base = defaultScheduleFormValues(spec.timeZone);
  switch (spec.type) {
    case "ONE_TIME":
      return { ...base, type: spec.type, runAt: parseLocalDateTime(spec.runAt) };
    case "INTERVAL":
      return { ...base, type: spec.type, every: spec.every, unit: spec.unit };
    case "WEEKLY":
      return { ...base, type: spec.type, daysOfWeek: sortDays(spec.daysOfWeek), time: parseLocalTime(spec.time) };
    case "CRON":
      return { ...base, type: spec.type, expression: spec.expression };
  }
}

/**
 * Builds the API ScheduleSpec from form values, keeping only the active type's fields.
 * Returns null while the values are incomplete (used by the live preview).
 */
export function formValuesToSpec(values: Partial<ScheduleFormValues> | null | undefined): ScheduleSpec | null {
  if (!values?.type || !values.timeZone) return null;
  const { timeZone } = values;
  switch (values.type) {
    case "ONE_TIME": {
      const runAt = values.runAt;
      if (!runAt || !dayjs.isDayjs(runAt) || !runAt.isValid()) return null;
      return { type: "ONE_TIME", runAt: formatLocalDateTime(runAt), timeZone };
    }
    case "INTERVAL": {
      const { every, unit } = values;
      if (typeof every !== "number" || !Number.isFinite(every) || !unit) return null;
      return { type: "INTERVAL", every, unit, timeZone };
    }
    case "WEEKLY": {
      const days = sortDays(values.daysOfWeek ?? []);
      const time = values.time;
      if (days.length === 0 || !time || !dayjs.isDayjs(time) || !time.isValid()) return null;
      return { type: "WEEKLY", daysOfWeek: days, time: formatLocalTime(time), timeZone };
    }
    case "CRON": {
      const expression = normalizeCronExpression(values.expression ?? "");
      if (!expression) return null;
      return { type: "CRON", expression, timeZone };
    }
    default:
      return null;
  }
}

/** Cleans up a spec returned by the API (e.g. "09:30:00" → "09:30") so it can be sent back as-is. */
export function normalizeSpec(spec: ScheduleSpec): ScheduleSpec {
  switch (spec.type) {
    case "ONE_TIME": {
      const runAt = parseLocalDateTime(spec.runAt);
      return { ...spec, runAt: runAt ? formatLocalDateTime(runAt) : spec.runAt };
    }
    case "WEEKLY":
      return { ...spec, daysOfWeek: sortDays(spec.daysOfWeek), time: normalizeLocalTime(spec.time) };
    default:
      return spec;
  }
}

/** True when the wall-clock `value` in `timeZone` is still in the future. */
export function isFutureInZone(value: Dayjs, timeZone: string, now: Dayjs = dayjs()): boolean {
  try {
    const instant = dayjs.tz(value.format("YYYY-MM-DD HH:mm:ss"), timeZone);
    return instant.isAfter(now);
  } catch {
    // Unknown zone: let the server decide.
    return true;
  }
}

/** Today's date in `timeZone`, as "YYYY-MM-DD", to disable past days in the date picker. */
export function todayInZone(timeZone: string, now: Dayjs = dayjs()): string {
  try {
    return now.tz(timeZone).format("YYYY-MM-DD");
  } catch {
    return now.format("YYYY-MM-DD");
  }
}
