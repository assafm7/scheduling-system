import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, Form } from "antd";
import { describe, expect, it, vi } from "vitest";
import { openDropdown, selectedLabel } from "@/test/antd";
import dayjs from "@/utils/dayjs";
import { defaultScheduleFormValues, formValuesToSpec, type ScheduleFormValues } from "@/utils/scheduleForm";
import { ScheduleFields } from "./ScheduleFields";

function Harness({
  schedule = defaultScheduleFormValues("UTC"),
  onFinish = vi.fn(),
}: {
  schedule?: ScheduleFormValues;
  onFinish?: (values: { schedule: ScheduleFormValues }) => void;
}) {
  return (
    <Form layout="vertical" initialValues={{ schedule }} onFinish={onFinish}>
      <ScheduleFields />
      <Button htmlType="submit">Submit</Button>
    </Form>
  );
}

async function submittedSpec(onFinish: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(onFinish).toHaveBeenCalled());
  return formValuesToSpec(onFinish.mock.lastCall?.[0].schedule);
}

describe("ScheduleFields", () => {
  it("starts on Interval with the default time zone selected", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: /interval/i })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Interval" })).toHaveValue("15");
    expect(selectedLabel("Interval unit")).toBe("minutes");
    expect(selectedLabel("Time zone")).toBe("UTC (GMT)");
  });

  it("searches time zones by city name and submits the chosen zone", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Harness onFinish={onFinish} />);

    await user.click(screen.getByRole("combobox", { name: "Time zone" }));
    await user.type(screen.getByRole("combobox", { name: "Time zone" }), "new york");
    const dropdown = await openDropdown();
    const option = within(dropdown).getByText(/^America\/New York/);
    expect(within(dropdown).queryByText(/^Asia\/Jerusalem/)).not.toBeInTheDocument();
    await user.click(option);
    expect(selectedLabel("Time zone")).toMatch(/^America\/New York \(GMT-\d\)$/);

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await submittedSpec(onFinish)).toMatchObject({ timeZone: "America/New_York" });
  });

  it("shows the matching inputs when switching between the four types", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText("One-time"));
    expect(screen.getByPlaceholderText("Select date and time")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Interval" })).not.toBeInTheDocument();

    await user.click(screen.getByText("Weekly"));
    expect(screen.getByRole("group", { name: "Days of week" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("HH:mm")).toHaveValue("09:00");
    expect(screen.queryByPlaceholderText("Select date and time")).not.toBeInTheDocument();

    await user.click(screen.getByText("Cron"));
    expect(screen.getByLabelText("Cron expression")).toBeInTheDocument();
    expect(screen.getByText(/Quartz format/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Days of week" })).not.toBeInTheDocument();

    await user.click(screen.getByText("Interval"));
    expect(screen.getByRole("spinbutton", { name: "Interval" })).toBeInTheDocument();
    // Every type keeps a time zone selector.
    expect(screen.getByRole("combobox", { name: "Time zone" })).toBeInTheDocument();
  });

  it("toggles weekly days and submits them in week order", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Harness onFinish={onFinish} />);

    await user.click(screen.getByText("Weekly"));
    // Defaults to weekdays.
    expect(screen.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Saturday" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Weekends" }));
    await user.click(screen.getByRole("button", { name: "Wednesday" }));
    expect(screen.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await submittedSpec(onFinish)).toEqual({
      type: "WEEKLY",
      daysOfWeek: ["WEDNESDAY", "SATURDAY", "SUNDAY"],
      time: "09:00",
      timeZone: "UTC",
    });
  });

  it("requires at least one weekly day", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Harness schedule={{ ...defaultScheduleFormValues("UTC"), type: "WEEKLY", daysOfWeek: ["MONDAY"] }} onFinish={onFinish} />);

    await user.click(screen.getByRole("button", { name: "Monday" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Pick at least one day")).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("fills a cron expression from a preset and describes it", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Harness onFinish={onFinish} />);

    await user.click(screen.getByText("Cron"));
    await user.click(screen.getByRole("button", { name: "Weekdays at 09:00" }));

    expect(screen.getByLabelText("Cron expression")).toHaveValue("0 0 9 ? * MON-FRI");
    expect(screen.getByTestId("cron-description")).toHaveTextContent("At 09:00, Monday through Friday");

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await submittedSpec(onFinish)).toEqual({ type: "CRON", expression: "0 0 9 ? * MON-FRI", timeZone: "UTC" });
  });

  it("rejects cron expressions with the wrong number of fields", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Harness onFinish={onFinish} />);

    await user.click(screen.getByText("Cron"));
    await user.type(screen.getByLabelText("Cron expression"), "*/5 * * * *");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText(/has 6 or 7 fields/)).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("requires an interval value", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Harness onFinish={onFinish} />);

    await user.clear(screen.getByRole("spinbutton", { name: "Interval" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Enter how often to run")).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("requires a run time for one-time schedules", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Harness onFinish={onFinish} />);

    await user.click(screen.getByText("One-time"));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Pick a date and time")).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("rejects a one-time run in the past", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    const past = defaultScheduleFormValues("UTC");
    past.type = "ONE_TIME";
    past.runAt = dayjs("2020-01-01T10:00:00");
    render(<Harness schedule={past} onFinish={onFinish} />);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The run time must be in the future")).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("submits a one-time schedule in the future", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    const future = defaultScheduleFormValues("Asia/Jerusalem");
    future.type = "ONE_TIME";
    future.runAt = dayjs("2099-05-01T08:30:00");
    render(<Harness schedule={future} onFinish={onFinish} />);

    expect(screen.getByPlaceholderText("Select date and time")).toHaveValue("2099-05-01 08:30");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await submittedSpec(onFinish)).toEqual({
      type: "ONE_TIME",
      runAt: "2099-05-01T08:30:00",
      timeZone: "Asia/Jerusalem",
    });
  });
});
