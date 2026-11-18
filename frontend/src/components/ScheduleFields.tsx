"use client";

import {
  CalendarOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  RedoOutlined,
} from "@ant-design/icons";
import { Button, Col, DatePicker, Flex, Form, Input, InputNumber, Row, Segmented, Select, Space, TimePicker, Typography } from "antd";
import type { Rule } from "antd/es/form";
import { useMemo, type ReactNode } from "react";
import type { IntervalUnit, ScheduleType } from "@/api/types";
import { describeCron } from "@/utils/describeSchedule";
import dayjs, { type Dayjs } from "@/utils/dayjs";
import { isFutureInZone, todayInZone } from "@/utils/scheduleForm";
import { timeZoneOptions, type TimeZoneOption } from "@/utils/timeZones";
import { DaysOfWeekPicker } from "./DaysOfWeekPicker";

export const SCHEDULE_TYPE_OPTIONS: { value: ScheduleType; label: string; icon: ReactNode }[] = [
  { value: "ONE_TIME", label: "One-time", icon: <CalendarOutlined /> },
  { value: "INTERVAL", label: "Interval", icon: <RedoOutlined /> },
  { value: "WEEKLY", label: "Weekly", icon: <ClockCircleOutlined /> },
  { value: "CRON", label: "Cron", icon: <CodeOutlined /> },
];

const UNIT_OPTIONS: { value: IntervalUnit; label: string }[] = [
  { value: "MINUTES", label: "minutes" },
  { value: "HOURS", label: "hours" },
  { value: "DAYS", label: "days" },
];

export const CRON_PRESETS: { label: string; expression: string }[] = [
  { label: "Every 15 minutes", expression: "0 0/15 * * * ?" },
  { label: "Every hour", expression: "0 0 * * * ?" },
  { label: "Weekdays at 09:00", expression: "0 0 9 ? * MON-FRI" },
  { label: "1st of month at midnight", expression: "0 0 0 1 * ?" },
];

export const INTERVAL_MIN = 1;
export const INTERVAL_MAX = 1000;
export const CRON_MAX_LENGTH = 120;

const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

const cronFieldCountRule: Rule = {
  validator: (_, value?: string) => {
    const fields = (value ?? "").trim().split(/\s+/).filter(Boolean);
    if (fields.length === 0 || fields.length === 6 || fields.length === 7) return Promise.resolve();
    return Promise.reject(
      new Error("A Quartz cron expression has 6 or 7 fields: sec min hour day-of-month month day-of-week [year]"),
    );
  },
};

function filterTimeZone(input: string, option?: TimeZoneOption): boolean {
  if (!option) return false;
  const query = input.trim().toLowerCase().replace(/[\s_]+/g, " ");
  const haystack = `${option.value} ${option.label}`.toLowerCase().replace(/[\s_]+/g, " ");
  return haystack.includes(query);
}

function CronHelp({ expression }: { expression: string }) {
  const description = describeCron(expression);
  return (
    <Flex vertical gap={2}>
      {description && (
        <Typography.Text type="success" data-testid="cron-description">
          {description}
        </Typography.Text>
      )}
      <span>
        Quartz format: <Typography.Text code>sec min hour day-of-month month day-of-week [year]</Typography.Text>. Use{" "}
        <Typography.Text code>?</Typography.Text> in one of the two day fields. Schedules may run at most once per
        minute.
      </span>
    </Flex>
  );
}

/** Schedule configuration: type selector, the inputs for the chosen type, and a time zone. */
export function ScheduleFields() {
  const form = Form.useFormInstance();
  const type: ScheduleType | undefined = Form.useWatch(["schedule", "type"], form);
  const timeZone: string | undefined = Form.useWatch(["schedule", "timeZone"], form);
  const expression: string | undefined = Form.useWatch(["schedule", "expression"], form);

  const zoneOptions = useMemo(() => timeZoneOptions(timeZone), [timeZone]);

  const runAtRules: Rule[] = [
    { required: true, message: "Pick a date and time" },
    {
      validator: (_, value?: Dayjs | null) =>
        !value || !timeZone || isFutureInZone(value, timeZone)
          ? Promise.resolve()
          : Promise.reject(new Error("The run time must be in the future")),
    },
  ];

  const applyPreset = (preset: string) => {
    form.setFieldValue(["schedule", "expression"], preset);
    void form.validateFields([["schedule", "expression"]]).catch(() => undefined);
  };

  const timeZoneField = (
    <Form.Item
      name={["schedule", "timeZone"]}
      label="Time zone"
      rules={[{ required: true, message: "Select a time zone" }]}
      extra="Times follow this zone's local clock, including daylight saving."
    >
      <Select
        showSearch={{ filterOption: filterTimeZone }}
        options={zoneOptions}
        placeholder="Select a time zone"
        popupMatchSelectWidth={false}
      />
    </Form.Item>
  );

  return (
    <>
      <Form.Item name={["schedule", "type"]} label="Repeat" rules={[{ required: true, message: "Choose a schedule type" }]}>
        <Segmented block options={SCHEDULE_TYPE_OPTIONS} />
      </Form.Item>

      {type === "ONE_TIME" && (
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name={["schedule", "runAt"]}
              label="Run at"
              rules={runAtRules}
              dependencies={[["schedule", "timeZone"]]}
            >
              <DatePicker
                showTime={{ format: "HH:mm" }}
                format="YYYY-MM-DD HH:mm"
                placeholder="Select date and time"
                style={{ width: "100%" }}
                disabledDate={(current: Dayjs) =>
                  current.format("YYYY-MM-DD") < todayInZone(timeZone ?? dayjs.tz.guess())
                }
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            {timeZoneField}
          </Col>
        </Row>
      )}

      {type === "INTERVAL" && (
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item label="Every" required extra="Minimum: once per minute">
              <Space.Compact block>
                <Form.Item
                  name={["schedule", "every"]}
                  noStyle
                  rules={[
                    { required: true, message: "Enter how often to run" },
                    {
                      type: "integer",
                      min: INTERVAL_MIN,
                      max: INTERVAL_MAX,
                      message: `Enter a whole number from ${INTERVAL_MIN} to ${INTERVAL_MAX}`,
                    },
                  ]}
                >
                  <InputNumber aria-label="Interval" min={INTERVAL_MIN} max={INTERVAL_MAX} precision={0} style={{ width: "50%" }} />
                </Form.Item>
                <Form.Item name={["schedule", "unit"]} noStyle rules={[{ required: true, message: "Choose a unit" }]}>
                  <Select aria-label="Interval unit" options={UNIT_OPTIONS} style={{ width: "50%" }} />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            {timeZoneField}
          </Col>
        </Row>
      )}

      {type === "WEEKLY" && (
        <>
          <Form.Item
            name={["schedule", "daysOfWeek"]}
            label="On"
            rules={[{ required: true, type: "array", min: 1, message: "Pick at least one day" }]}
          >
            <DaysOfWeekPicker />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name={["schedule", "time"]} label="At" rules={[{ required: true, message: "Pick a time" }]}>
                <TimePicker format="HH:mm" needConfirm={false} placeholder="HH:mm" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              {timeZoneField}
            </Col>
          </Row>
        </>
      )}

      {type === "CRON" && (
        <>
          <Form.Item
            name={["schedule", "expression"]}
            label="Cron expression"
            rules={[
              { required: true, whitespace: true, message: "Enter a cron expression" },
              { max: CRON_MAX_LENGTH, message: `At most ${CRON_MAX_LENGTH} characters` },
              cronFieldCountRule,
            ]}
            extra={<CronHelp expression={expression ?? ""} />}
          >
            <Input
              placeholder="0 0/15 * * * ?"
              spellCheck={false}
              autoComplete="off"
              maxLength={CRON_MAX_LENGTH}
              style={{ fontFamily: MONO_FONT }}
            />
          </Form.Item>
          <Flex wrap gap={6} align="center" style={{ marginBottom: 16, marginTop: -4 }}>
            <Typography.Text type="secondary">Presets:</Typography.Text>
            {CRON_PRESETS.map((preset) => (
              <Button key={preset.expression} size="small" onClick={() => applyPreset(preset.expression)} title={preset.expression}>
                {preset.label}
              </Button>
            ))}
          </Flex>
          {timeZoneField}
        </>
      )}
    </>
  );
}
