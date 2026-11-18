import type {
  ProblemDetail,
  SchedulePreviewResponse,
  ScheduleSpec,
  SchedulingRequest,
  SchedulingResponse,
  TaskDefinition,
} from "./types";

/** Same-origin base path; Next.js rewrites /api/* to the Spring Boot backend, so no CORS is involved. */
const API_BASE = "/api";

export const CONFLICT_MESSAGE = "This scheduling was modified elsewhere. Reload and try again.";

const DEFAULT_MESSAGES: Record<number, string> = {
  0: "Unable to reach the server. Check your connection and try again.",
  400: "The request is invalid. Check the highlighted fields.",
  404: "The scheduling was not found. It may have been deleted.",
  409: CONFLICT_MESSAGE,
  500: "Something went wrong on the server. Please try again.",
};

/** An error returned by the API, normalized from an RFC 9457 ProblemDetail body. */
export class ApiError extends Error {
  readonly status: number;
  /** Field-level errors keyed by field path, e.g. "parameters.message" or "schedule.expression". */
  readonly fieldErrors: Record<string, string>;
  readonly problem: ProblemDetail | null;

  constructor(
    status: number,
    message: string,
    fieldErrors: Record<string, string> = {},
    problem: ProblemDetail | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.problem = problem;
  }

  get isValidation(): boolean {
    return this.status === 400;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

function defaultMessage(status: number): string {
  return DEFAULT_MESSAGES[status] ?? DEFAULT_MESSAGES[status >= 500 ? 500 : 400];
}

/** Keeps only string values, so unexpected payloads can never be rendered as anything but text. */
function sanitizeFieldErrors(errors: unknown): Record<string, string> {
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) result[key] = value;
  }
  return result;
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetail | null = null;
  try {
    const text = await response.text();
    const parsed: unknown = text ? JSON.parse(text) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      problem = parsed as ProblemDetail;
    }
  } catch {
    // Non-JSON error body (e.g. a proxy error page): fall back to the default message.
  }
  const detail = typeof problem?.detail === "string" && problem.detail.trim() ? problem.detail : null;
  return new ApiError(
    response.status,
    detail ?? defaultMessage(response.status),
    sanitizeFieldErrors(problem?.errors),
    problem,
  );
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, { method = "GET", body, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json, application/problem+json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    // Let React Query see aborts as aborts; everything else is a network failure.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, defaultMessage(0));
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const schedulingPath = (id: string) => `/schedulings/${encodeURIComponent(id)}`;

export function listTasks(signal?: AbortSignal): Promise<TaskDefinition[]> {
  return request<TaskDefinition[]>("/tasks", { signal });
}

export function listSchedulings(signal?: AbortSignal): Promise<SchedulingResponse[]> {
  return request<SchedulingResponse[]>("/schedulings", { signal });
}

export function getScheduling(id: string, signal?: AbortSignal): Promise<SchedulingResponse> {
  return request<SchedulingResponse>(schedulingPath(id), { signal });
}

export function createScheduling(body: SchedulingRequest): Promise<SchedulingResponse> {
  return request<SchedulingResponse>("/schedulings", { method: "POST", body });
}

export function updateScheduling(id: string, body: SchedulingRequest): Promise<SchedulingResponse> {
  return request<SchedulingResponse>(schedulingPath(id), { method: "PUT", body });
}

export function deleteScheduling(id: string): Promise<void> {
  return request<void>(schedulingPath(id), { method: "DELETE" });
}

export function previewSchedule(spec: ScheduleSpec, signal?: AbortSignal): Promise<SchedulePreviewResponse> {
  return request<SchedulePreviewResponse>("/schedulings/preview", { method: "POST", body: spec, signal });
}
