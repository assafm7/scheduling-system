import cronstrue from "cronstrue";
import type { DayOfWeek, IntervalUnit, ScheduleSpec } from "@/api/types";
import { normalizeLocalTime, parseLocalDateTime, sortDays, WEEKDAYS, WEEKEND } from "./scheduleForm";

export const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

const UNIT_LABELS: Record<IntervalUnit, [singular: string, plural: string]> = {
  MINUTES: ["minute", "minutes"],
  HOURS: ["hour", "hours"],
  DAYS: ["day", "days"],
};

export function describeInterval(every: number, unit: IntervalUnit): string {
  const [singular, plural] = UNIT_LABELS[unit] ?? [unit.toLowerCase(), unit.toLowerCase()];
  return every === 1 ? `Every ${singular}` : `Every ${every} ${plural}`;
}

function sameDays(a: readonly DayOfWeek[], b: readonly DayOfWeek[]): boolean {
  return a.length === b.length && a.every((day) => b.includes(day));
}

export function describeDays(days: readonly DayOfWeek[]): string {
  const sorted = sortDays(days);
  if (sorted.length === 7) return "Every day";
  if (sameDays(sorted, WEEKDAYS)) return "Every weekday";
  if (sameDays(sorted, WEEKEND)) return "Every weekend";
  return `Every ${sorted.map((day) => DAY_SHORT_LABELS[day]).join(", ")}`;
}

/** Human-readable cron description (Quartz syntax), or null when cronstrue can't parse it. */
export function describeCron(expression: string): string | null {
  const trimmed = expression.trim();
  if (!trimmed) return null;
  try {
    return cronstrue.toString(trimmed, { use24HourTimeFormat: true, throwExceptionOnParseError: true });
  } catch {
    return null;
  }
}

/** One-line summary of a schedule for tables and previews. */
export function describeSchedule(spec: ScheduleSpec): string {
  const zone = ` (${spec.timeZone})`;
  switch (spec.type) {
    case "ONE_TIME": {
      const runAt = parseLocalDateTime(spec.runAt);
      return `Once on ${runAt ? runAt.format("MMM D, YYYY HH:mm") : spec.runAt}${zone}`;
    }
    case "INTERVAL":
      return describeInterval(spec.every, spec.unit);
    case "WEEKLY":
      return `${describeDays(spec.daysOfWeek)} at ${normalizeLocalTime(spec.time)}${zone}`;
    case "CRON": {
      const description = describeCron(spec.expression);
      return description ? `${description}${zone}` : spec.expression;
    }
    default:
      return "Unknown schedule";
  }
}
