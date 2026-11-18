import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, Form } from "antd";
import { describe, expect, it, vi } from "vitest";
import type { ParameterDefinition } from "@/api/types";
import { chooseOption } from "@/test/antd";
import { EMAIL_TASK, LOG_TASK } from "@/test/fixtures";
import { TaskParameterFields } from "./TaskParameterFields";

function Harness({ parameters, onFinish }: { parameters: ParameterDefinition[]; onFinish: (values: unknown) => void }) {
  return (
    <Form layout="vertical" onFinish={onFinish}>
      <TaskParameterFields parameters={parameters} />
      <Button htmlType="submit">Submit</Button>
    </Form>
  );
}

const ALL_TYPES: ParameterDefinition[] = [
  { name: "short", label: "Short text", type: "STRING", required: false, description: "A short one", options: null, maxLength: 50 },
  { name: "long", label: "Long text", type: "STRING", required: false, description: null, options: null, maxLength: 2000 },
  { name: "count", label: "Count", type: "NUMBER", required: false, description: null, options: null, maxLength: null },
  { name: "flag", label: "Flag", type: "BOOLEAN", required: false, description: null, options: null, maxLength: null },
  { name: "mail", label: "Mail", type: "EMAIL", required: false, description: null, options: null, maxLength: null },
  { name: "level", label: "Level", type: "ENUM", required: false, description: null, options: ["INFO", "WARN"], maxLength: null },
];

describe("TaskParameterFields", () => {
  it("renders the right input for each parameter type", () => {
    render(<Harness parameters={ALL_TYPES} onFinish={vi.fn()} />);

    const short = screen.getByLabelText("Short text");
    expect(short.tagName).toBe("INPUT");
    expect(short).toHaveAttribute("maxlength", "50");
    expect(screen.getByText("A short one")).toBeInTheDocument();

    // maxLength above 200 switches to a multi-line text area.
    expect(screen.getByLabelText("Long text").tagName).toBe("TEXTAREA");
    expect(screen.getByRole("spinbutton", { name: "Count" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Flag" })).toBeInTheDocument();
    expect(screen.getByLabelText("Mail")).toHaveAttribute("type", "email");
    expect(screen.getByRole("combobox", { name: "Level" })).toBeInTheDocument();
  });

  it("blocks submit and explains when a required parameter is missing", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Harness parameters={LOG_TASK.parameters} onFinish={onFinish} />);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Message is required")).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("validates email addresses and submits typed values", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Harness parameters={EMAIL_TASK.parameters} onFinish={onFinish} />);

    await user.type(screen.getByLabelText("To"), "not-an-email");
    await user.type(screen.getByLabelText("Subject"), "Hello");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("To"));
    await user.type(screen.getByLabelText("To"), "team@example.com");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith({
        parameters: { to: "team@example.com", subject: "Hello", body: undefined },
      }),
    );
  });

  it("collects enum, number and boolean values", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<Harness parameters={ALL_TYPES} onFinish={onFinish} />);

    await chooseOption(user, "Level", "WARN");
    await user.type(screen.getByRole("spinbutton", { name: "Count" }), "42");
    await user.click(screen.getByRole("switch", { name: "Flag" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(onFinish).toHaveBeenCalled());
    expect(onFinish.mock.calls[0][0]).toMatchObject({ parameters: { level: "WARN", count: 42, flag: true } });
  });

  it("says so when the task has no parameters", () => {
    render(<Harness parameters={[]} onFinish={vi.fn()} />);
    expect(screen.getByText("This task takes no parameters.")).toBeInTheDocument();
  });
});
