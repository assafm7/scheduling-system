import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DayOfWeek } from "@/api/types";
import { DaysOfWeekPicker } from "./DaysOfWeekPicker";

function Controlled({ initial, onChange }: { initial: DayOfWeek[]; onChange: (days: DayOfWeek[]) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DaysOfWeekPicker
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed");

describe("DaysOfWeekPicker", () => {
  it("shows Mon–Sun toggles reflecting the value", () => {
    render(<DaysOfWeekPicker value={["MONDAY", "WEDNESDAY"]} />);
    const group = screen.getByRole("group", { name: "Days of week" });
    expect(group).toBeInTheDocument();
    expect(pressed("Monday")).toBe("true");
    expect(pressed("Tuesday")).toBe("false");
    expect(pressed("Wednesday")).toBe("true");
    expect(pressed("Sunday")).toBe("false");
  });

  it("toggles days on and off, keeping week order", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial={["WEDNESDAY"]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Monday" }));
    expect(onChange).toHaveBeenLastCalledWith(["MONDAY", "WEDNESDAY"]);
    expect(pressed("Monday")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Wednesday" }));
    expect(onChange).toHaveBeenLastCalledWith(["MONDAY"]);
    expect(pressed("Wednesday")).toBe("false");
  });

  it("offers weekday, weekend and every-day shortcuts", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Weekdays" }));
    expect(onChange).toHaveBeenLastCalledWith(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]);

    await user.click(screen.getByRole("button", { name: "Weekends" }));
    expect(onChange).toHaveBeenLastCalledWith(["SATURDAY", "SUNDAY"]);

    await user.click(screen.getByRole("button", { name: "Every day" }));
    expect(onChange).toHaveBeenLastCalledWith([
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ]);
  });
});
