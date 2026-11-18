import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listSchedulings, listTasks, previewSchedule } from "@/api/client";
import { SCHEDULINGS, TASKS } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { SchedulingsPage } from "./SchedulingsPage";

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  listSchedulings: vi.fn(),
  listTasks: vi.fn(),
  previewSchedule: vi.fn(),
}));

const listMock = vi.mocked(listSchedulings);

beforeEach(() => {
  listMock.mockReset();
  vi.mocked(listTasks).mockResolvedValue(TASKS);
  vi.mocked(previewSchedule).mockResolvedValue({ nextFireTimes: [] });
});

describe("SchedulingsPage", () => {
  it("loads and lists the schedulings", async () => {
    listMock.mockResolvedValue(SCHEDULINGS);
    renderWithProviders(<SchedulingsPage />);

    expect(screen.getByRole("status", { name: "Loading schedulings" })).toBeInTheDocument();
    expect(await screen.findByText("Weekly digest")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(SCHEDULINGS.length + 1);
  });

  it("opens an empty form for a new scheduling and closes it on cancel", async () => {
    listMock.mockResolvedValue(SCHEDULINGS);
    const { user } = renderWithProviders(<SchedulingsPage />);
    await screen.findByText("Weekly digest");

    await user.click(screen.getByRole("button", { name: /new scheduling/i }));
    const dialog = await screen.findByRole("dialog", { name: "New scheduling" });
    expect(within(dialog).getByLabelText("Name")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("opens the edit form pre-filled for the chosen row", async () => {
    listMock.mockResolvedValue(SCHEDULINGS);
    const { user } = renderWithProviders(<SchedulingsPage />);
    await screen.findByText("Weekly digest");

    await user.click(screen.getByRole("button", { name: "Edit Nightly report" }));

    const dialog = await screen.findByRole("dialog", { name: "Edit scheduling" });
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Nightly report");
    expect(within(dialog).getByLabelText("Cron expression")).toHaveValue("0 0 9 ? * MON-FRI");
  });

  it("retries after a failed load", async () => {
    listMock.mockRejectedValueOnce(new Error("Network down")).mockResolvedValueOnce([]);
    const { user } = renderWithProviders(<SchedulingsPage />);

    expect(await screen.findByText("Couldn't load schedulings")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No schedulings yet")).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(2);
  });
});
