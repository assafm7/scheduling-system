"use client";

import { Form, Input, InputNumber, Select, Switch, Typography } from "antd";
import type { Rule } from "antd/es/form";
import type { ParameterDefinition } from "@/api/types";

/** Strings longer than this get a multi-line text area instead of a single-line input. */
export const TEXTAREA_THRESHOLD = 200;

export function parameterRules(parameter: ParameterDefinition): Rule[] {
  const rules: Rule[] = [];
  const label = parameter.label || parameter.name;
  if (parameter.required && parameter.type !== "BOOLEAN") {
    rules.push({
      required: true,
      whitespace: parameter.type !== "NUMBER" && parameter.type !== "ENUM",
      message: `${label} is required`,
    });
  }
  if (parameter.type === "EMAIL") {
    rules.push({ type: "email", message: "Enter a valid email address" });
  }
  if (parameter.type === "NUMBER") {
    rules.push({ type: "number", message: `${label} must be a number` });
  }
  if (parameter.type === "ENUM" && parameter.options?.length) {
    rules.push({ type: "enum", enum: parameter.options, message: `Choose one of: ${parameter.options.join(", ")}` });
  }
  if (parameter.maxLength && (parameter.type === "STRING" || parameter.type === "EMAIL")) {
    rules.push({ max: parameter.maxLength, message: `${label} must be at most ${parameter.maxLength} characters` });
  }
  return rules;
}

/** Returns the bare input element so antd Form.Item can inject value/onChange/id into it. */
function renderInput(parameter: ParameterDefinition) {
  const maxLength = parameter.maxLength ?? undefined;
  const placeholder = parameter.required ? undefined : "Optional";
  switch (parameter.type) {
    case "NUMBER":
      return <InputNumber style={{ width: "100%" }} placeholder={placeholder} />;
    case "BOOLEAN":
      return <Switch />;
    case "EMAIL":
      return (
        <Input type="email" autoComplete="email" maxLength={maxLength} placeholder={placeholder ?? "name@example.com"} />
      );
    case "ENUM":
      return (
        <Select
          allowClear={!parameter.required}
          placeholder={parameter.required ? "Select an option" : "Optional"}
          options={(parameter.options ?? []).map((option) => ({ value: option, label: option }))}
        />
      );
    case "STRING":
    default:
      if (maxLength && maxLength > TEXTAREA_THRESHOLD) {
        return (
          <Input.TextArea
            maxLength={maxLength}
            showCount
            autoSize={{ minRows: 2, maxRows: 6 }}
            placeholder={placeholder}
          />
        );
      }
      return <Input maxLength={maxLength} showCount={Boolean(maxLength)} placeholder={placeholder} />;
  }
}

interface TaskParameterFieldsProps {
  parameters: ParameterDefinition[];
}

/** Renders one form input per parameter of the selected task, driven entirely by the task's schema. */
export function TaskParameterFields({ parameters }: TaskParameterFieldsProps) {
  if (parameters.length === 0) {
    return (
      <Typography.Text type="secondary" data-testid="no-parameters">
        This task takes no parameters.
      </Typography.Text>
    );
  }

  return (
    <>
      {parameters.map((parameter) => {
        const isBoolean = parameter.type === "BOOLEAN";
        return (
          <Form.Item
            key={parameter.name}
            name={["parameters", parameter.name]}
            label={parameter.label || parameter.name}
            required={parameter.required}
            rules={parameterRules(parameter)}
            extra={parameter.description ?? undefined}
            valuePropName={isBoolean ? "checked" : "value"}
          >
            {renderInput(parameter)}
          </Form.Item>
        );
      })}
    </>
  );
}
