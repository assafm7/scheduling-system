"use client";

import { Alert, App, Button, Col, Flex, Form, Input, Modal, Row, Select, Skeleton, Switch, Typography } from "antd";
import { useMemo, useState, type ReactNode } from "react";
import { ApiError, CONFLICT_MESSAGE } from "@/api/client";
import type { SchedulingResponse, TaskDefinition } from "@/api/types";
import { useCreateScheduling, useFetchScheduling, useUpdateScheduling } from "@/hooks/useSchedulings";
import { useTasks } from "@/hooks/useTasks";
import { humanizeFieldKey, mapFieldErrors } from "@/utils/formErrors";
import { formValuesToSpec, type ScheduleFormValues } from "@/utils/scheduleForm";
import {
  formValuesToRequest,
  initialParameterValues,
  newSchedulingFormValues,
  schedulingToFormValues,
  type SchedulingFormValues,
} from "@/utils/schedulingForm";
import { browserTimeZone } from "@/utils/timeZones";
import { NextRunsPreview } from "./NextRunsPreview";
import { ScheduleFields } from "./ScheduleFields";
import { TaskParameterFields } from "./TaskParameterFields";

export const NAME_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 500;

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography.Title level={5} className="form-section-title">
      {children}
    </Typography.Title>
  );
}

interface SchedulingFormModalProps {
  open: boolean;
  /** The scheduling to edit; omit (or null) to create a new one. */
  scheduling?: SchedulingResponse | null;
  onClose: () => void;
  afterClose?: () => void;
}

/** Create/edit form: details → task + schema-driven parameters → schedule + live next-runs preview. */
export function SchedulingFormModal({ open, scheduling = null, onClose, afterClose }: SchedulingFormModalProps) {
  const [form] = Form.useForm<SchedulingFormValues>();
  const { message, notification } = App.useApp();
  const tasksQuery = useTasks();
  const createMutation = useCreateScheduling();
  const updateMutation = useUpdateScheduling();
  const fetchScheduling = useFetchScheduling();

  // The server copy being edited; replaced when the user reloads after a conflict.
  const [current, setCurrent] = useState<SchedulingResponse | null>(scheduling);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const isEdit = current !== null;

  const initialValues = useMemo(
    () => (scheduling ? schedulingToFormValues(scheduling) : newSchedulingFormValues(browserTimeZone())),
    [scheduling],
  );

  const tasks: TaskDefinition[] = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const taskKey: string | undefined = Form.useWatch("taskKey", form);
  const selectedTask = tasks.find((task) => task.key === taskKey);
  const scheduleValues: ScheduleFormValues | undefined = Form.useWatch("schedule", form);
  const previewSpec = useMemo(() => formValuesToSpec(scheduleValues), [scheduleValues]);
  const saving = createMutation.isPending || updateMutation.isPending;

  const handleTaskChange = (key: string) => {
    // Parameters belong to a task's schema, so a different task starts from a clean slate.
    const task = tasks.find((candidate) => candidate.key === key);
    form.setFieldValue("parameters", initialParameterValues(task));
  };

  const showSaveError = (description: ReactNode) =>
    notification.error({ title: isEdit ? "Could not save changes" : "Could not create the scheduling", description });

  const handleError = (error: unknown) => {
    if (!(error instanceof ApiError)) {
      showSaveError("An unexpected error occurred. Please try again.");
      return;
    }
    if (error.isConflict) {
      setConflict(true);
      return;
    }
    if (error.isNotFound && isEdit) {
      notification.error({ title: "Scheduling not found", description: "It was deleted elsewhere." });
      onClose();
      return;
    }
    if (error.isValidation) {
      const registered = form.getFieldsError().map((field) => field.name);
      const { fields, unmapped } = mapFieldErrors(error.fieldErrors, registered);
      if (fields.length > 0) {
        // Paths come from the server at runtime, so they can't be checked against the form's static type.
        form.setFields(fields as Parameters<typeof form.setFields>[0]);
        form.scrollToField(fields[0].name, { block: "center", behavior: "smooth" });
      }
      if (unmapped.length > 0) {
        showSaveError(
          <ul className="error-list">
            {unmapped.map(({ key, message: text }) => (
              <li key={key}>
                <strong>{humanizeFieldKey(key)}</strong>: {text}
              </li>
            ))}
          </ul>,
        );
      } else if (fields.length === 0) {
        showSaveError(error.message);
      }
      return;
    }
    showSaveError(error.message);
  };

  const handleSubmit = async () => {
    let values: SchedulingFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // antd renders the field errors and scrolls to the first one (scrollToFirstError).
    }
    const request = formValuesToRequest(values, selectedTask, current?.version);
    setConflict(false);
    try {
      if (current) {
        await updateMutation.mutateAsync({ id: current.id, request });
        message.success("Scheduling updated");
      } else {
        await createMutation.mutateAsync(request);
        message.success("Scheduling created");
      }
      onClose();
    } catch (error) {
      handleError(error);
    }
  };

  const handleReload = async () => {
    if (!current) return;
    setReloading(true);
    try {
      const latest = await fetchScheduling(current.id);
      const values = schedulingToFormValues(latest);
      form.resetFields();
      form.setFieldsValue(values);
      form.setFieldValue("parameters", values.parameters);
      setCurrent(latest);
      setConflict(false);
      message.info("Loaded the latest version");
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound) {
        notification.error({ title: "Scheduling not found", description: "It was deleted elsewhere." });
        onClose();
      } else {
        notification.error({
          title: "Could not reload the scheduling",
          description: error instanceof Error ? error.message : undefined,
        });
      }
    } finally {
      setReloading(false);
    }
  };

  const taskOptions = tasks.map((task) => ({ value: task.key, label: task.name, description: task.description }));
  const unknownTask = isEdit && !tasksQuery.isPending && taskKey !== undefined && !selectedTask;

  return (
    <Modal
      open={open}
      title={isEdit ? "Edit scheduling" : "New scheduling"}
      okText={isEdit ? "Save changes" : "Create scheduling"}
      onOk={handleSubmit}
      onCancel={onClose}
      afterClose={afterClose}
      confirmLoading={saving}
      width={760}
      style={{ top: 32 }}
      mask={{ closable: false }}
      destroyOnHidden
    >
      {conflict && (
        <Alert
          type="warning"
          showIcon
          role="alert"
          title={CONFLICT_MESSAGE}
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={handleReload} loading={reloading}>
              Reload
            </Button>
          }
        />
      )}
      <Form<SchedulingFormValues>
        form={form}
        layout="vertical"
        initialValues={initialValues}
        scrollToFirstError={{ block: "center", behavior: "smooth" }}
        disabled={saving}
        name="scheduling"
      >
        <SectionTitle>Details</SectionTitle>
        <Row gutter={16}>
          <Col xs={24} md={17}>
            <Form.Item
              name="name"
              label="Name"
              rules={[
                { required: true, whitespace: true, message: "Name is required" },
                { max: NAME_MAX_LENGTH, message: `Name must be at most ${NAME_MAX_LENGTH} characters` },
              ]}
            >
              <Input placeholder="e.g. Nightly cleanup report" maxLength={NAME_MAX_LENGTH} showCount autoFocus />
            </Form.Item>
          </Col>
          <Col xs={24} md={7}>
            <Form.Item name="enabled" label="Enabled" valuePropName="checked" tooltip="Disabled schedulings are kept but never run">
              <Switch checkedChildren="On" unCheckedChildren="Off" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="description"
          label="Description"
          rules={[{ max: DESCRIPTION_MAX_LENGTH, message: `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters` }]}
        >
          <Input.TextArea
            placeholder="Optional"
            maxLength={DESCRIPTION_MAX_LENGTH}
            showCount
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
        </Form.Item>

        <SectionTitle>Task</SectionTitle>
        {tasksQuery.isError ? (
          <Alert
            type="error"
            showIcon
            title="Couldn't load the available tasks"
            description={tasksQuery.error.message}
            action={
              <Button size="small" onClick={() => void tasksQuery.refetch()}>
                Retry
              </Button>
            }
            style={{ marginBottom: 16 }}
          />
        ) : null}
        <Form.Item
          name="taskKey"
          label="Task"
          rules={[{ required: true, message: "Select a task" }]}
          extra={selectedTask?.description}
        >
          <Select
            placeholder="Select a task"
            loading={tasksQuery.isPending}
            options={taskOptions}
            onChange={handleTaskChange}
            optionRender={(option) => (
              <Flex vertical>
                <span>{option.data.label}</span>
                <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: "normal" }}>
                  {option.data.description}
                </Typography.Text>
              </Flex>
            )}
          />
        </Form.Item>
        {unknownTask && (
          <Alert
            type="warning"
            showIcon
            title="This scheduling uses a task that no longer exists. Select another task."
            style={{ marginBottom: 16 }}
          />
        )}
        {selectedTask ? (
          <div className="parameters-panel" aria-label="Task parameters" role="group">
            <TaskParameterFields parameters={selectedTask.parameters} />
          </div>
        ) : tasksQuery.isPending && isEdit ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : null}

        <SectionTitle>Schedule</SectionTitle>
        <ScheduleFields />
        <NextRunsPreview spec={previewSpec} />
      </Form>
    </Modal>
  );
}
