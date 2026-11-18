"use client";

import { Button, Flex } from "antd";
import { DAYS_OF_WEEK, type DayOfWeek } from "@/api/types";
import { DAY_SHORT_LABELS } from "@/utils/describeSchedule";
import { sortDays, WEEKDAYS, WEEKEND } from "@/utils/scheduleForm";

const DAY_FULL_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

const SHORTCUTS: { label: string; days: readonly DayOfWeek[] }[] = [
  { label: "Weekdays", days: WEEKDAYS },
  { label: "Weekends", days: WEEKEND },
  { label: "Every day", days: DAYS_OF_WEEK },
];

interface DaysOfWeekPickerProps {
  id?: string;
  value?: DayOfWeek[];
  onChange?: (value: DayOfWeek[]) => void;
  disabled?: boolean;
}

/** Toggle buttons for Mon–Sun (antd Form-compatible: value/onChange), plus quick-select shortcuts. */
export function DaysOfWeekPicker({ id, value = [], onChange, disabled }: DaysOfWeekPickerProps) {
  const toggle = (day: DayOfWeek) => {
    const next = value.includes(day) ? value.filter((d) => d !== day) : [...value, day];
    onChange?.(sortDays(next));
  };

  return (
    <Flex vertical gap={8} id={id}>
      <Flex wrap gap={6} role="group" aria-label="Days of week">
        {DAYS_OF_WEEK.map((day) => {
          const selected = value.includes(day);
          return (
            <Button
              key={day}
              type={selected ? "primary" : "default"}
              aria-pressed={selected}
              aria-label={DAY_FULL_LABELS[day]}
              title={DAY_FULL_LABELS[day]}
              disabled={disabled}
              onClick={() => toggle(day)}
              style={{ minWidth: 52 }}
            >
              {DAY_SHORT_LABELS[day]}
            </Button>
          );
        })}
      </Flex>
      <Flex wrap gap={4}>
        {SHORTCUTS.map((shortcut) => (
          <Button
            key={shortcut.label}
            type="link"
            size="small"
            disabled={disabled}
            onClick={() => onChange?.([...shortcut.days])}
            style={{ paddingInline: 4 }}
          >
            {shortcut.label}
          </Button>
        ))}
      </Flex>
    </Flex>
  );
}
