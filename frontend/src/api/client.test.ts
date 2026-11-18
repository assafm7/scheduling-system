import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeScheduling, TASKS } from "@/test/fixtures";
import {
  ApiError,
  createScheduling,
  deleteScheduling,
  getScheduling,
  listSchedulings,
  listTasks,
  previewSchedule,
  updateScheduling,
} from "./client";
import type { SchedulingRequest } from "./types";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": contentType } });
}

const request: SchedulingRequest = {
  name: "Heartbeat",
  description: null,
  taskKey: "LOG",
  parameters: { message: "hi" },
  schedule: { type: "INTERVAL", every: 5, unit: "MINUTES", timeZone: "UTC" },
  enabled: true,
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("GETs JSON from the same-origin /api prefix", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(TASKS));
    await expect(listTasks()).resolves.toEqual(TASKS);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/tasks");
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
  });

  it("lists and fetches schedulings, encoding ids", async () => {
    const scheduling = makeScheduling();
    fetchMock.mockResolvedValueOnce(jsonResponse([scheduling])).mockResolvedValueOnce(jsonResponse(scheduling));
    await expect(listSchedulings()).resolves.toEqual([scheduling]);
    await expect(getScheduling("a/b")).resolves.toEqual(scheduling);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/schedulings/a%2Fb");
  });

  it("POSTs and PUTs JSON bodies", async () => {
    const created = makeScheduling();
    fetchMock.mockResolvedValueOnce(jsonResponse(created, 201)).mockResolvedValueOnce(jsonResponse(created));

    await expect(createScheduling(request)).resolves.toEqual(created);
    let [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/schedulings");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(request);
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");

    await updateScheduling(created.id, { ...request, version: 3 });
    [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`/api/schedulings/${created.id}`);
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body)).version).toBe(3);
  });

  it("handles 204 No Content on delete", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteScheduling("abc")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
  });

  it("posts a schedule spec for preview", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ nextFireTimes: ["2026-11-18T13:30:00Z"] }));
    await expect(previewSchedule(request.schedule)).resolves.toEqual({ nextFireTimes: ["2026-11-18T13:30:00Z"] });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/schedulings/preview");
  });

  it("turns a ProblemDetail into an ApiError with field errors", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          detail: "Validation failed",
          instance: "/api/schedulings",
          errors: { "parameters.message": "is required", "schedule.expression": "invalid cron", bogus: 42 },
        },
        400,
        "application/problem+json",
      ),
    );

    const error = await createScheduling(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.isValidation).toBe(true);
    expect(apiError.message).toBe("Validation failed");
    // Non-string values are dropped, so nothing unexpected is ever rendered.
    expect(apiError.fieldErrors).toEqual({ "parameters.message": "is required", "schedule.expression": "invalid cron" });
    expect(apiError.problem?.title).toBe("Bad Request");
  });

  it.each([
    [404, "The scheduling was not found. It may have been deleted."],
    [409, "This scheduling was modified elsewhere. Reload and try again."],
    [500, "Something went wrong on the server. Please try again."],
    [503, "Something went wrong on the server. Please try again."],
  ])("uses a friendly default message for %i without a detail", async (status, message) => {
    fetchMock.mockResolvedValueOnce(new Response("<html>oops</html>", { status }));
    const error = (await listSchedulings().catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(status);
    expect(error.message).toBe(message);
    expect(error.fieldErrors).toEqual({});
    expect(error.isConflict).toBe(status === 409);
    expect(error.isNotFound).toBe(status === 404);
  });

  it("reports network failures as status 0", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const error = (await listTasks().catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/unable to reach the server/i);
  });

  it("rethrows aborts untouched", async () => {
    const abort = new DOMException("The operation was aborted.", "AbortError");
    fetchMock.mockRejectedValueOnce(abort);
    await expect(listSchedulings(new AbortController().signal)).rejects.toBe(abort);
  });
});
