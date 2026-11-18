import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, deleteScheduling, updateScheduling } from "@/api/client";
import { makeScheduling, SCHEDULINGS } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { SchedulingsTable, type SchedulingsTableProps } from "./SchedulingsTable";

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  updateScheduling: vi.fn(),
  deleteScheduling: vi.fn(),
}));

const updateMock = vi.mocked(updateScheduling);
const deleteMock = vi.mocked(deleteScheduling);

function renderTable(props: Partial<SchedulingsTableProps> = {}) {
  const handlers = { onRetry: vi.fn(), onCreate: vi.fn(), onEdit: vi.fn() };
  const result = renderWithProviders(
    <SchedulingsTable schedulings={SCHEDULINGS} loading={false} error={null} {...handlers} {...props} />,
  );
  return { ...result, ...handlers };
}

function row(name: string): HTMLElement {
  const cell = screen.getByText(name, { selector: "strong, span" });
  const tr = cell.closest("tr");
  if (!tr) throw new Error(`Row "${name}" not found`);
  return tr;
}

/** The open Popconfirm (its own role="tooltip" root, distinct from hover tooltips). */
async function findConfirm(): Promise<HTMLElement> {
  const title = await screen.findByText("Delete this scheduling?");
  const popover = title.closest<HTMLElement>(".ant-popover");
  if (!popover) throw new Error("Popconfirm not found");
  return popover;
}

function rowNames(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((tr) => tr.querySelector("td strong")?.textContent ?? "");
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
  updateMock.mockReset();
  deleteMock.mockReset();
});

describe("SchedulingsTable", () => {
  it("renders a row per scheduling with readable columns", () => {
    renderTable();

    expect(screen.getByRole("heading", { name: "Schedulings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new scheduling/i })).toBeInTheDocument();
    expect(rowNames()).toEqual(["Heartbeat log", "Weekly digest", "Launch announcement", "Nightly report"]);

    const heartbeat = within(row("Heartbeat log"));
    expect(heartbeat.getByText("Proves the scheduler is alive")).toBeInTheDocument();
    expect(heartbeat.getByText("Log message")).toBeInTheDocument();
    expect(heartbeat.getByText("Every 15 minutes")).toBeInTheDocument();
    expect(heartbeat.getByText("message: Still alive")).toBeInTheDocument();
    expect(heartbeat.getByText("level: INFO")).toBeInTheDocument();
    expect(heartbeat.getByText("Nov 18, 2026 12:15")).toBeInTheDocument();
    expect(heartbeat.getByText("in 15 minutes")).toBeInTheDocument();
    expect(heartbeat.getByText("Active")).toBeInTheDocument();

    expect(within(row("Weekly digest")).getByText("Every Mon, Wed at 09:30 (Asia/Jerusalem)")).toBeInTheDocument();
    expect(within(row("Nightly report")).getByText("At 09:00, Monday through Friday (UTC)")).toBeInTheDocument();
    expect(within(row("Nightly report")).getByText("0 0 9 ? * MON-FRI")).toBeInTheDocument();
    expect(within(row("Nightly report")).getByText("Paused")).toBeInTheDocument();
  });

  it("marks completed schedulings and disables their switch", () => {
    renderTable();
    const launch = within(row("Launch announcement"));
    expect(launch.getByText("Completed")).toBeInTheDocument();
    expect(launch.getByText("Once on Nov 18, 2026 09:59 (UTC)")).toBeInTheDocument();
    expect(launch.getByText("—", { selector: "span" })).toBeInTheDocument();
    expect(launch.getByRole("switch", { name: "Enabled: Launch announcement" })).toBeDisabled();
  });

  it("shows two parameter tags and collapses the rest into a +N tag", () => {
    renderTable({
      schedulings: [makeScheduling({ parameters: { a: "1", b: "2", c: "3", d: "4", e: "5" } })],
    });
    expect(screen.getByText("+3 more")).toBeInTheDocument();
    expect(screen.getByText("a: 1")).toBeInTheDocument();
    expect(screen.queryByText("c: 3")).not.toBeInTheDocument();
  });

  it("shows a loading state before data arrives", () => {
    renderTable({ schedulings: undefined, loading: true });
    expect(screen.getByRole("status", { name: "Loading schedulings" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an error with a Retry button that refetches", async () => {
    const { user, onRetry } = renderTable({
      schedulings: undefined,
      error: new ApiError(0, "Unable to reach the server. Check your connection and try again."),
    });

    expect(screen.getByText("Couldn't load schedulings")).toBeInTheDocument();
    expect(screen.getByText(/Unable to reach the server/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps showing data when a background refresh fails", () => {
    renderTable({ error: new Error("boom") });
    expect(screen.getByText(/Couldn't refresh the list/)).toBeInTheDocument();
    expect(rowNames()).toHaveLength(4);
  });

  it("shows an empty state with a call to action", async () => {
    const { user, onCreate } = renderTable({ schedulings: [] });

    expect(screen.getByText("No schedulings yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create your first scheduling/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("opens the create form from the header", async () => {
    const { user, onCreate } = renderTable();
    await user.click(screen.getByRole("button", { name: /new scheduling/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("sorts by name and by next run", async () => {
    const { user } = renderTable();

    await user.click(screen.getByText("Name", { selector: "th *" }));
    expect(rowNames()).toEqual(["Heartbeat log", "Launch announcement", "Nightly report", "Weekly digest"]);

    await user.click(screen.getByText("Next run", { selector: "th *" }));
    // Soonest first; schedulings without a next run go last.
    expect(rowNames().slice(0, 2)).toEqual(["Heartbeat log", "Weekly digest"]);
  });

  it("filters rows by search text", async () => {
    const { user } = renderTable();
    await user.type(screen.getByRole("textbox", { name: "Search schedulings" }), "email");
    expect(rowNames()).toEqual(["Weekly digest"]);

    await user.clear(screen.getByRole("textbox", { name: "Search schedulings" }));
    await user.type(screen.getByRole("textbox", { name: "Search schedulings" }), "zzz");
    expect(screen.getByText("No schedulings match “zzz”")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(rowNames()).toHaveLength(4);
  });

  it("edits a scheduling", async () => {
    const { user, onEdit } = renderTable();
    await user.click(screen.getByRole("button", { name: "Edit Weekly digest" }));
    expect(onEdit).toHaveBeenCalledWith(SCHEDULINGS[1]);
  });

  it("toggles enabled with a full PUT carrying the version", async () => {
    const heartbeat = SCHEDULINGS[0];
    updateMock.mockResolvedValue({ ...heartbeat, enabled: false, status: "PAUSED", version: 4 });
    const { user } = renderTable();

    await user.click(screen.getByRole("switch", { name: "Enabled: Heartbeat log" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledWith(heartbeat.id, {
      name: "Heartbeat log",
      description: "Proves the scheduler is alive",
      taskKey: "LOG",
      parameters: { message: "Still alive", level: "INFO" },
      schedule: { type: "INTERVAL", every: 15, unit: "MINUTES", timeZone: "UTC" },
      enabled: false,
      version: 3,
    });
    expect(await screen.findByText("“Heartbeat log” disabled")).toBeInTheDocument();
  });

  it("re-enables a paused scheduling, normalizing backend time formats", async () => {
    updateMock.mockResolvedValue(SCHEDULINGS[1]);
    const { user } = renderTable({ schedulings: [{ ...SCHEDULINGS[1], enabled: false, status: "PAUSED" }] });

    await user.click(screen.getByRole("switch", { name: "Enabled: Weekly digest" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][1]).toMatchObject({
      enabled: true,
      version: 1,
      schedule: { type: "WEEKLY", daysOfWeek: ["MONDAY", "WEDNESDAY"], time: "09:30", timeZone: "Asia/Jerusalem" },
    });
    expect(await screen.findByText("“Weekly digest” enabled")).toBeInTheDocument();
  });

  it("explains a concurrent modification when toggling fails with 409", async () => {
    updateMock.mockRejectedValue(new ApiError(409, "Conflict"));
    const { user } = renderTable();

    await user.click(screen.getByRole("switch", { name: "Enabled: Heartbeat log" }));

    expect(await screen.findByText("This scheduling was modified elsewhere. Reload and try again.")).toBeInTheDocument();
  });

  it("reports other toggle failures", async () => {
    updateMock.mockRejectedValue(new ApiError(500, "Something went wrong on the server. Please try again."));
    const { user } = renderTable();

    await user.click(screen.getByRole("switch", { name: "Enabled: Heartbeat log" }));

    expect(await screen.findByText("Could not disable “Heartbeat log”")).toBeInTheDocument();
  });

  it("asks for confirmation before deleting", async () => {
    deleteMock.mockResolvedValue(undefined);
    const { user } = renderTable();

    await user.click(screen.getByRole("button", { name: "Delete Weekly digest" }));
    expect(deleteMock).not.toHaveBeenCalled();

    const confirm = await findConfirm();
    expect(within(confirm).getByText("“Weekly digest” will be removed and will no longer run.")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(SCHEDULINGS[1].id));
    expect(await screen.findByText("“Weekly digest” deleted")).toBeInTheDocument();
  });

  it("does not delete when the confirmation is cancelled", async () => {
    const { user } = renderTable();

    await user.click(screen.getByRole("button", { name: "Delete Weekly digest" }));
    const confirm = await findConfirm();
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));

    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("treats deleting an already-deleted scheduling as done", async () => {
    deleteMock.mockRejectedValue(new ApiError(404, "Not found"));
    const { user } = renderTable();

    await user.click(screen.getByRole("button", { name: "Delete Heartbeat log" }));
    await user.click(within(await findConfirm()).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("“Heartbeat log” was already deleted")).toBeInTheDocument();
  });

  it("reports delete failures", async () => {
    deleteMock.mockRejectedValue(new ApiError(500, "Server down"));
    const { user } = renderTable();

    await user.click(screen.getByRole("button", { name: "Delete Heartbeat log" }));
    await user.click(within(await findConfirm()).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Could not delete “Heartbeat log”")).toBeInTheDocument();
    expect(screen.getByText("Server down")).toBeInTheDocument();
  });
});
