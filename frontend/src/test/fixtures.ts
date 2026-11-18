import type { SchedulingResponse, TaskDefinition } from "@/api/types";

export const LOG_TASK: TaskDefinition = {
  key: "LOG",
  name: "Log message",
  description: "Writes a message to the application log.",
  parameters: [
    { name: "message", label: "Message", type: "STRING", required: true, description: "Text to log", options: null, maxLength: 1000 },
    { name: "level", label: "Level", type: "ENUM", required: false, description: null, options: ["INFO", "WARN", "ERROR"], maxLength: null },
  ],
};

export const EMAIL_TASK: TaskDefinition = {
  key: "EMAIL",
  name: "Send email (simulated)",
  description: "Pretends to send an email by logging it.",
  parameters: [
    { name: "to", label: "To", type: "EMAIL", required: true, description: null, options: null, maxLength: null },
    { name: "subject", label: "Subject", type: "STRING", required: true, description: null, options: null, maxLength: 200 },
    { name: "body", label: "Body", type: "STRING", required: false, description: null, options: null, maxLength: 2000 },
  ],
};

export const DB_REPORT_TASK: TaskDefinition = {
  key: "DB_REPORT",
  name: "Database report",
  description: "Runs a fixed reporting query and logs the result.",
  parameters: [
    {
      name: "report",
      label: "Report",
      type: "ENUM",
      required: true,
      description: null,
      options: ["SCHEDULING_COUNT", "SCHEDULINGS_PER_TASK"],
      maxLength: null,
    },
  ],
};

export const TASKS: TaskDefinition[] = [LOG_TASK, EMAIL_TASK, DB_REPORT_TASK];

export function makeScheduling(overrides: Partial<SchedulingResponse> = {}): SchedulingResponse {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Heartbeat log",
    description: "Proves the scheduler is alive",
    taskKey: "LOG",
    taskName: "Log message",
    parameters: { message: "Still alive", level: "INFO" },
    schedule: { type: "INTERVAL", every: 15, unit: "MINUTES", timeZone: "UTC" },
    enabled: true,
    status: "ACTIVE",
    nextFireTime: "2026-11-18T12:15:00Z",
    version: 3,
    createdAt: "2026-11-18T10:00:00Z",
    updatedAt: "2026-11-18T11:00:00Z",
    ...overrides,
  };
}

export const SCHEDULINGS: SchedulingResponse[] = [
  makeScheduling(),
  makeScheduling({
    id: "22222222-2222-4222-8222-222222222222",
    name: "Weekly digest",
    description: null,
    taskKey: "EMAIL",
    taskName: "Send email (simulated)",
    parameters: { to: "team@example.com", subject: "Weekly digest", body: "Hello team" },
    // As the backend returns it: seconds included.
    schedule: { type: "WEEKLY", daysOfWeek: ["WEDNESDAY", "MONDAY"], time: "09:30:00", timeZone: "Asia/Jerusalem" },
    nextFireTime: "2026-11-23T07:30:00Z",
    version: 1,
  }),
  makeScheduling({
    id: "33333333-3333-4333-8333-333333333333",
    name: "Launch announcement",
    description: null,
    taskKey: "LOG",
    taskName: "Log message",
    parameters: { message: "We are live!" },
    schedule: { type: "ONE_TIME", runAt: "2026-11-18T09:59:29", timeZone: "UTC" },
    enabled: true,
    status: "COMPLETED",
    nextFireTime: null,
    version: 2,
  }),
  makeScheduling({
    id: "44444444-4444-4444-8444-444444444444",
    name: "Nightly report",
    description: null,
    taskKey: "DB_REPORT",
    taskName: "Database report",
    parameters: { report: "SCHEDULING_COUNT" },
    schedule: { type: "CRON", expression: "0 0 9 ? * MON-FRI", timeZone: "UTC" },
    enabled: false,
    status: "PAUSED",
    nextFireTime: null,
    version: 5,
  }),
];
