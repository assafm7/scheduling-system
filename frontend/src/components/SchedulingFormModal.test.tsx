import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createScheduling,
  getScheduling,
  listTasks,
  previewSchedule,
  updateScheduling,
} from "@/api/client";
import type { SchedulingResponse } from "@/api/types";
import { chooseOption, selectedLabel } from "@/test/antd";
import { makeScheduling, SCHEDULINGS, TASKS } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { SchedulingFormModal } from "./SchedulingFormModal";

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  listTasks: vi.fn(),
  createScheduling: vi.fn(),
  updateScheduling: vi.fn(),
  getScheduling: vi.fn(),
  previewSchedule: vi.fn(),
}));

const createMock = vi.mocked(createScheduling);
const updateMock = vi.mocked(updateScheduling);
const getMock = vi.mocked(getScheduling);

function renderModal(scheduling: SchedulingResponse | null = null) {
  const onClose = vi.fn();
  const result = renderWithProviders(<SchedulingFormModal open scheduling={scheduling} onClose={onClose} />);
  return { ...result, onClose };
}

async function waitForTasks() {
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Task" })).toBeEnabled());
  await waitFor(() => expect(listTasks).toHaveBeenCalled());
}

const WEEKLY_DIGEST = SCHEDULINGS[1];

beforeEach(() => {
  vi.mocked(listTasks).mockResolvedValue(TASKS);
  vi.mocked(previewSchedule).mockResolvedValue({ nextFireTimes: ["2099-01-01T09:00:00Z"] });
  createMock.mockReset();
  updateMock.mockReset();
  getMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SchedulingFormModal — create", () => {
  it("submits the exact SchedulingRequest built from the form", async () => {
    createMock.mockResolvedValue(makeScheduling());
    const { user, onClose } = renderModal();
    expect(screen.getByRole("dialog", { name: "New scheduling" })).toBeInTheDocument();
    await waitForTasks();

    await user.type(screen.getByLabelText("Name"), "  Nightly heartbeat ");
    await user.type(screen.getByLabelText("Description"), "Keeps an eye on things");
    await chooseOption(user, "Task", "Log message");
    // The selected task's description is shown under the select.
    expect(
      screen.getAllByText("Writes a message to the application log.").some((el) => el.closest(".ant-form-item-extra")),
    ).toBe(true);
    await user.type(await screen.findByLabelText("Message"), "Hello world");
    await chooseOption(user, "Level", "WARN");
    await user.click(screen.getByRole("button", { name: "Create scheduling" }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith({
      name: "Nightly heartbeat",
      description: "Keeps an eye on things",
      taskKey: "LOG",
      parameters: { message: "Hello world", level: "WARN" },
      schedule: { type: "INTERVAL", every: 15, unit: "MINUTES", timeZone: "UTC" },
      enabled: true,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await screen.findByText("Scheduling created")).toBeInTheDocument();
  });

  it("builds a cron schedule and omits empty optional parameters", async () => {
    createMock.mockResolvedValue(makeScheduling());
    const { user } = renderModal();
    await waitForTasks();

    await user.type(screen.getByLabelText("Name"), "Report");
    await chooseOption(user, "Task", "Database report");
    await chooseOption(user, "Report", "SCHEDULINGS_PER_TASK");
    await user.click(screen.getByText("Cron"));
    await user.click(screen.getByRole("button", { name: "1st of month at midnight" }));
    await user.click(screen.getByRole("switch", { name: /^enabled/i }));
    await user.click(screen.getByRole("button", { name: "Create scheduling" }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith({
      name: "Report",
      description: null,
      taskKey: "DB_REPORT",
      parameters: { report: "SCHEDULINGS_PER_TASK" },
      schedule: { type: "CRON", expression: "0 0 0 1 * ?", timeZone: "UTC" },
      enabled: false,
    });
  });

  it("blocks submit until required fields are filled", async () => {
    const { user } = renderModal();
    await waitForTasks();

    await user.click(screen.getByRole("button", { name: "Create scheduling" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Choose a task to run")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();

    await chooseOption(user, "Task", "Send email (simulated)");
    await user.type(screen.getByLabelText("Name"), "Mail");
    await user.click(screen.getByRole("button", { name: "Create scheduling" }));
    expect(await screen.findByText("To is required")).toBeInTheDocument();
    expect(screen.getByText("Subject is required")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("defaults the time zone to the browser's", async () => {
    const resolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (this: Intl.DateTimeFormat) {
      return { ...resolvedOptions.call(this), timeZone: "Asia/Jerusalem" };
    });
    renderModal();
    await waitForTasks();

    expect(selectedLabel("Time zone")).toMatch(/^Asia\/Jerusalem \(GMT\+\d\)$/);
  });

  it("maps 400 field errors onto the form and reports the rest", async () => {
    createMock.mockRejectedValue(
      new ApiError(400, "Validation failed", {
        name: "A scheduling with this name already exists",
        "parameters.message": "must not contain line breaks",
        "schedule.every": "must run at most once per minute",
        "parameters.unknown": "is not a parameter of LOG",
      }),
    );
    const { user, onClose } = renderModal();
    await waitForTasks();

    await user.type(screen.getByLabelText("Name"), "Dup");
    await chooseOption(user, "Task", "Log message");
    await user.type(await screen.findByLabelText("Message"), "Hi");
    await user.click(screen.getByRole("button", { name: "Create scheduling" }));

    // Messages land under their fields; fragments are prefixed with the field's label.
    expect(await screen.findByText("A scheduling with this name already exists")).toBeInTheDocument();
    expect(screen.getByText("Message must not contain line breaks")).toBeInTheDocument();
    expect(screen.getByText("Interval must run at most once per minute")).toBeInTheDocument();
    // Keys without a matching field end up in a notification.
    expect(await screen.findByText("Could not create the scheduling")).toBeInTheDocument();
    expect(screen.getByText("Parameter “unknown” is not a parameter of LOG")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows server errors that aren't about fields", async () => {
    createMock.mockRejectedValue(new ApiError(500, "Something went wrong on the server. Please try again."));
    const { user, onClose } = renderModal();
    await waitForTasks();

    await user.type(screen.getByLabelText("Name"), "Boom");
    await chooseOption(user, "Task", "Log message");
    await user.type(await screen.findByLabelText("Message"), "Hi");
    await user.click(screen.getByRole("button", { name: "Create scheduling" }));

    expect(await screen.findByText("Something went wrong on the server. Please try again.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("offers a retry when the tasks can't be loaded", async () => {
    vi.mocked(listTasks).mockRejectedValueOnce(new ApiError(500, "Tasks are down")).mockResolvedValueOnce(TASKS);
    const { user } = renderModal();

    expect(await screen.findByText("Couldn't load the available tasks")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByText("Couldn't load the available tasks")).not.toBeInTheDocument());
  });

  it("closes on Cancel", async () => {
    const { user, onClose } = renderModal();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("SchedulingFormModal — edit", () => {
  it("pre-fills every field from the existing scheduling", async () => {
    renderModal(WEEKLY_DIGEST);
    expect(screen.getByRole("dialog", { name: "Edit scheduling" })).toBeInTheDocument();
    await waitForTasks();

    expect(screen.getByLabelText("Name")).toHaveValue("Weekly digest");
    expect(screen.getByRole("switch", { name: /^enabled/i })).toBeChecked();
    expect(selectedLabel("Task")).toBe("Send email (simulated)");
    expect(await screen.findByLabelText("To")).toHaveValue("team@example.com");
    expect(screen.getByLabelText("Subject")).toHaveValue("Weekly digest");
    expect(screen.getByLabelText("Body")).toHaveValue("Hello team");
    expect(screen.getByRole("radio", { name: /weekly/i })).toBeChecked();
    const days = screen.getByRole("group", { name: "Days of week" });
    expect(within(days).getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "true");
    expect(within(days).getByRole("button", { name: "Tuesday" })).toHaveAttribute("aria-pressed", "false");
    expect(within(days).getByRole("button", { name: "Wednesday" })).toHaveAttribute("aria-pressed", "true");
    // The backend sends "09:30:00"; the picker shows HH:mm.
    expect(screen.getByPlaceholderText("HH:mm")).toHaveValue("09:30");
    expect(selectedLabel("Time zone")).toMatch(/^Asia\/Jerusalem/);
  });

  it("pre-fills a one-time schedule, accepting runAt with seconds", async () => {
    renderModal(SCHEDULINGS[2]);
    await waitForTasks();

    expect(screen.getByRole("radio", { name: /one-time/i })).toBeChecked();
    // "2026-11-18T09:59:29" from the backend.
    expect(screen.getByPlaceholderText("Select date and time")).toHaveValue("2026-11-18 09:59");
    expect(await screen.findByLabelText("Message")).toHaveValue("We are live!");
  });

  it("pre-fills interval and cron schedules", async () => {
    const { unmount } = renderModal(
      makeScheduling({ schedule: { type: "INTERVAL", every: 6, unit: "HOURS", timeZone: "Europe/London" } }),
    );
    await waitForTasks();
    expect(screen.getByRole("radio", { name: /interval/i })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Interval" })).toHaveValue("6");
    expect(selectedLabel("Interval unit")).toBe("hours");
    expect(selectedLabel("Time zone")).toMatch(/^Europe\/London/);
    unmount();

    renderModal(SCHEDULINGS[3]);
    await waitForTasks();
    expect(screen.getByRole("radio", { name: /cron/i })).toBeChecked();
    expect(screen.getByLabelText("Cron expression")).toHaveValue("0 0 9 ? * MON-FRI");
    expect(screen.getByRole("switch", { name: /^enabled/i })).not.toBeChecked();
    expect(selectedLabel("Report")).toBe("SCHEDULING_COUNT");
  });

  it("PUTs the edited scheduling with its version", async () => {
    updateMock.mockResolvedValue({ ...WEEKLY_DIGEST, version: 2 });
    const { user, onClose } = renderModal(WEEKLY_DIGEST);
    await waitForTasks();

    const subject = await screen.findByLabelText("Subject");
    await user.clear(subject);
    await user.type(subject, "Monday & Wednesday digest");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledWith(WEEKLY_DIGEST.id, {
      name: "Weekly digest",
      description: null,
      taskKey: "EMAIL",
      parameters: { to: "team@example.com", subject: "Monday & Wednesday digest", body: "Hello team" },
      schedule: { type: "WEEKLY", daysOfWeek: ["MONDAY", "WEDNESDAY"], time: "09:30", timeZone: "Asia/Jerusalem" },
      enabled: true,
      version: 1,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await screen.findByText("Scheduling updated")).toBeInTheDocument();
  });

  it("resets the parameters when the task changes", async () => {
    const { user } = renderModal(SCHEDULINGS[0]);
    await waitForTasks();
    expect(await screen.findByLabelText("Message")).toHaveValue("Still alive");

    await chooseOption(user, "Task", "Send email (simulated)");
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
    expect(screen.getByLabelText("To")).toHaveValue("");
    expect(screen.getByLabelText("Subject")).toHaveValue("");

    await chooseOption(user, "Task", "Log message");
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("explains a 409 conflict and reloads the latest version", async () => {
    updateMock.mockRejectedValueOnce(new ApiError(409, "Conflict"));
    getMock.mockResolvedValue({ ...WEEKLY_DIGEST, name: "Weekly digest (renamed)", version: 2 });
    const { user, onClose } = renderModal(WEEKLY_DIGEST);
    await waitForTasks();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const alert = await screen.findByText("This scheduling was modified elsewhere. Reload and try again.");
    expect(alert).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Weekly digest (renamed)"));
    expect(getMock).toHaveBeenCalledWith(WEEKLY_DIGEST.id, expect.anything());
    expect(screen.queryByText("This scheduling was modified elsewhere. Reload and try again.")).not.toBeInTheDocument();

    // The retry carries the fresh version.
    updateMock.mockResolvedValueOnce({ ...WEEKLY_DIGEST, version: 3 });
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(2));
    expect(updateMock.mock.calls[1][1]).toMatchObject({ name: "Weekly digest (renamed)", version: 2 });
  });

  it("closes when the scheduling was deleted elsewhere", async () => {
    updateMock.mockRejectedValue(new ApiError(404, "Not found"));
    const { user, onClose } = renderModal(WEEKLY_DIGEST);
    await waitForTasks();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Scheduling not found")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });
});
