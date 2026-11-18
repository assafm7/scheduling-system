// Types mirroring the backend REST contract (see README / plan "REST API (contract)").

export type ParameterType = "STRING" | "NUMBER" | "BOOLEAN" | "EMAIL" | "ENUM";

export interface ParameterDefinition {
  name: string;
  label: string;
  type: ParameterType;
  required: boolean;
  description: string | null;
  /** Allowed values, ENUM only. */
  options: string[] | null;
  maxLength: number | null;
}

export interface TaskDefinition {
  key: string;
  name: string;
  description: string;
  parameters: ParameterDefinition[];
}

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export type IntervalUnit = "MINUTES" | "HOURS" | "DAYS";

export interface OneTimeSchedule {
  type: "ONE_TIME";
  /** Local date-time without offset, e.g. "2026-11-18T15:30:00", interpreted in `timeZone`. */
  runAt: string;
  timeZone: string;
}

export interface IntervalSchedule {
  type: "INTERVAL";
  /** 1..1000 */
  every: number;
  unit: IntervalUnit;
  timeZone: string;
}

export interface WeeklySchedule {
  type: "WEEKLY";
  daysOfWeek: DayOfWeek[];
  /** "HH:mm" (responses may carry "HH:mm:ss"). */
  time: string;
  timeZone: string;
}

export interface CronSchedule {
  type: "CRON";
  /** Quartz syntax: sec min hour day-of-month month day-of-week [year]. */
  expression: string;
  timeZone: string;
}

export type ScheduleSpec = OneTimeSchedule | IntervalSchedule | WeeklySchedule | CronSchedule;

export type ScheduleType = ScheduleSpec["type"];

export type ParameterValue = string | number | boolean;

export interface SchedulingRequest {
  name: string;
  description?: string | null;
  taskKey: string;
  parameters: Record<string, ParameterValue>;
  schedule: ScheduleSpec;
  enabled: boolean;
  /** Required on PUT (optimistic locking). */
  version?: number;
}

export type SchedulingStatus = "ACTIVE" | "PAUSED" | "COMPLETED";

export interface SchedulingResponse {
  id: string;
  name: string;
  description: string | null;
  taskKey: string;
  taskName: string;
  parameters: Record<string, ParameterValue>;
  schedule: ScheduleSpec;
  enabled: boolean;
  status: SchedulingStatus;
  /** ISO instant, e.g. "2026-11-18T13:30:00Z". */
  nextFireTime: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulePreviewResponse {
  nextFireTimes: string[];
}

/** RFC 9457 problem details, as returned by the backend for every error. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  /** Field-level validation errors, keyed like "name", "parameters.message", "schedule.expression". */
  errors?: Record<string, string>;
}
