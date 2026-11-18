import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, previewSchedule } from "@/api/client";
import type { ScheduleSpec } from "@/api/types";
import { renderWithProviders } from "@/test/render";
import { NextRunsPreview, PREVIEW_DEBOUNCE_MS } from "./NextRunsPreview";

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  previewSchedule: vi.fn(),
}));

const previewMock = vi.mocked(previewSchedule);

const every15: ScheduleSpec = { type: "INTERVAL", every: 15, unit: "MINUTES", timeZone: "UTC" };
const every30: ScheduleSpec = { type: "INTERVAL", every: 30, unit: "MINUTES", timeZone: "UTC" };

/** Advances fake time and lets React Query and React flush the resulting updates. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function render(spec: ScheduleSpec | null) {
  // userEvent isn't used here, so fake timers don't need to drive it.
  return renderWithProviders(<NextRunsPreview spec={spec} />);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
  previewMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("NextRunsPreview", () => {
  it("lists the next fire times returned by the backend in local time", async () => {
    previewMock.mockResolvedValue({
      nextFireTimes: ["2026-11-18T12:15:00Z", "2026-11-18T12:30:00Z", "2026-11-18T12:45:00Z"],
    });
    render(every15);

    await advance(PREVIEW_DEBOUNCE_MS);
    await advance(0);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Wed, Nov 18, 2026 12:15");
    expect(items[0]).toHaveTextContent("in 15 minutes");
    expect(screen.getByTestId("schedule-summary")).toHaveTextContent("Every 15 minutes");
    expect(screen.getByText("Shown in your local time (UTC).")).toBeInTheDocument();
    expect(previewMock).toHaveBeenCalledWith(every15, expect.any(AbortSignal));
  });

  it("debounces edits and only asks for the settled schedule", async () => {
    previewMock.mockResolvedValue({ nextFireTimes: ["2026-11-18T12:30:00Z"] });
    const every45: ScheduleSpec = { ...every15, every: 45 };
    const { rerender } = render(every15);

    // The schedule the form opens with is previewed right away.
    await advance(0);
    expect(previewMock).toHaveBeenCalledTimes(1);

    // Rapid edits (typing "30", then "45") within the debounce window...
    rerender(<NextRunsPreview spec={every30} />);
    await advance(PREVIEW_DEBOUNCE_MS - 100);
    rerender(<NextRunsPreview spec={every45} />);
    await advance(PREVIEW_DEBOUNCE_MS - 100);
    expect(previewMock).toHaveBeenCalledTimes(1);

    // ...produce a single request, for the last value, once typing pauses.
    await advance(100);
    expect(previewMock).toHaveBeenCalledTimes(2);
    expect(previewMock).toHaveBeenLastCalledWith(every45, expect.any(AbortSignal));
    expect(previewMock).not.toHaveBeenCalledWith(every30, expect.anything());
  });

  it("shows the backend's validation message inline on a 400", async () => {
    // The exact shape the backend returns for a bad day-of-week.
    previewMock.mockRejectedValue(
      new ApiError(400, "One or more fields are invalid.", {
        "schedule.expression": "is not a valid Quartz cron expression (Invalid Day-of-Week value: 'FUN')",
      }),
    );
    render({ type: "CRON", expression: "0 0 9 ? * FUNDAY", timeZone: "UTC" });

    await advance(PREVIEW_DEBOUNCE_MS);
    await advance(0);

    expect(screen.getByTestId("preview-error")).toHaveTextContent(
      "Cron expression is not a valid Quartz cron expression (Invalid Day-of-Week value: 'FUN')",
    );
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("explains the one-minute minimum when a cron fires too often", async () => {
    previewMock.mockRejectedValue(
      new ApiError(400, "One or more fields are invalid.", {
        expression: "must not fire more often than once a minute",
      }),
    );
    render({ type: "CRON", expression: "* * * * * ?", timeZone: "UTC" });

    await advance(PREVIEW_DEBOUNCE_MS);
    await advance(0);

    expect(screen.getByTestId("preview-error")).toHaveTextContent(
      "Cron expression must not fire more often than once a minute",
    );
  });

  it("falls back to the error message when there are no field errors", async () => {
    previewMock.mockRejectedValue(new ApiError(500, "Something went wrong on the server. Please try again."));
    render(every15);

    await advance(PREVIEW_DEBOUNCE_MS);
    await advance(0);

    expect(screen.getByTestId("preview-error")).toHaveTextContent("Something went wrong on the server");
  });

  it("asks the user to complete the schedule instead of calling the backend", async () => {
    render(null);
    await advance(PREVIEW_DEBOUNCE_MS * 2);

    expect(screen.getByText("Complete the schedule to see when it will run.")).toBeInTheDocument();
    expect(previewMock).not.toHaveBeenCalled();
  });

  it("says when a schedule will never fire again", async () => {
    previewMock.mockResolvedValue({ nextFireTimes: [] });
    render({ type: "ONE_TIME", runAt: "2026-11-18T09:00:00", timeZone: "UTC" });

    await advance(PREVIEW_DEBOUNCE_MS);
    await advance(0);

    expect(screen.getByText("This schedule has no upcoming runs.")).toBeInTheDocument();
  });

  it("also shows the time in the schedule's zone when it differs from the local one", async () => {
    previewMock.mockResolvedValue({ nextFireTimes: ["2026-11-23T07:30:00Z"] });
    render({ type: "WEEKLY", daysOfWeek: ["MONDAY"], time: "09:30", timeZone: "Asia/Jerusalem" });

    await advance(PREVIEW_DEBOUNCE_MS);
    await advance(0);

    expect(screen.getByRole("listitem")).toHaveTextContent("Mon, Nov 23, 2026 07:30 · in 5 days · 09:30 in Asia/Jerusalem");
  });
});
