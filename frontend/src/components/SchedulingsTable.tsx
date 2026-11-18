"use client";

import {
  CalendarOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  RedoOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Alert, App, Button, Empty, Flex, Grid, Input, Popconfirm, Skeleton, Space, Switch, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState, type ReactNode } from "react";
import { ApiError, CONFLICT_MESSAGE } from "@/api/client";
import type { ParameterValue, ScheduleType, SchedulingResponse, SchedulingStatus } from "@/api/types";
import { useDeleteScheduling, useUpdateScheduling } from "@/hooks/useSchedulings";
import { useNow } from "@/hooks/useNow";
import dayjs from "@/utils/dayjs";
import { describeSchedule } from "@/utils/describeSchedule";
import { toggleRequest } from "@/utils/schedulingForm";
import { browserTimeZone } from "@/utils/timeZones";

const MAX_PARAMETER_TAGS = 2;

// Explicit widths keep the table inside its card on laptops; the Schedule column takes the
// remaining space. Task and Parameters drop out on narrower screens, and below the resulting
// minimum width the table scrolls horizontally with the Actions column pinned to the right.
const COLUMN_WIDTHS = { name: 190, task: 130, parameters: 180, nextRun: 165, status: 150, actions: 92 } as const;
const SCHEDULE_MIN_WIDTH = 200;

function tableMinWidth(showTask: boolean, showParameters: boolean): number {
  const { name, task, parameters, nextRun, status, actions } = COLUMN_WIDTHS;
  return name + nextRun + status + actions + SCHEDULE_MIN_WIDTH + (showTask ? task : 0) + (showParameters ? parameters : 0);
}

const SCHEDULE_ICONS: Record<ScheduleType, ReactNode> = {
  ONE_TIME: <CalendarOutlined />,
  INTERVAL: <RedoOutlined />,
  WEEKLY: <ClockCircleOutlined />,
  CRON: <CodeOutlined />,
};

const STATUS_TAGS: Record<SchedulingStatus, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "green" },
  PAUSED: { label: "Paused", color: "orange" },
  COMPLETED: { label: "Completed", color: "default" },
};

const ELLIPSIS_TAG_STYLE = {
  marginInlineEnd: 0,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

function formatParameter(key: string, value: ParameterValue): string {
  return `${key}: ${String(value)}`;
}

function ParameterTags({ parameters }: { parameters: Record<string, ParameterValue> }) {
  const entries = Object.entries(parameters ?? {});
  if (entries.length === 0) return <Typography.Text type="secondary">—</Typography.Text>;
  const visible = entries.slice(0, MAX_PARAMETER_TAGS);
  const hiddenCount = entries.length - visible.length;
  return (
    <Flex vertical gap={4} align="flex-start" style={{ minWidth: 0 }}>
      {visible.map(([key, value]) => {
        const text = formatParameter(key, value);
        return (
          <Tooltip key={key} title={text}>
            <Tag style={ELLIPSIS_TAG_STYLE}>{text}</Tag>
          </Tooltip>
        );
      })}
      {hiddenCount > 0 && (
        <Tooltip
          title={
            <ul className="tooltip-list">
              {entries.map(([key, value]) => (
                <li key={key}>{formatParameter(key, value)}</li>
              ))}
            </ul>
          }
        >
          <Tag style={{ marginInlineEnd: 0 }}>+{hiddenCount} more</Tag>
        </Tooltip>
      )}
    </Flex>
  );
}

function NextRun({ scheduling, now }: { scheduling: SchedulingResponse; now: number }) {
  if (!scheduling.nextFireTime) return <Typography.Text type="secondary">—</Typography.Text>;
  const instant = dayjs(scheduling.nextFireTime);
  if (!instant.isValid()) return <Typography.Text type="secondary">—</Typography.Text>;
  const zone = scheduling.schedule.timeZone;
  let zoned: string | null = null;
  try {
    zoned = `${instant.tz(zone).format("MMM D, YYYY HH:mm")} (${zone})`;
  } catch {
    zoned = null;
  }
  return (
    <Tooltip title={zoned}>
      <Flex vertical>
        <span>{instant.format("MMM D, YYYY HH:mm")}</span>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {instant.from(now)}
        </Typography.Text>
      </Flex>
    </Tooltip>
  );
}

function compareNextRun(a: SchedulingResponse, b: SchedulingResponse): number {
  // Schedulings without a next run sort last when ascending.
  const left = a.nextFireTime ? Date.parse(a.nextFireTime) : Number.POSITIVE_INFINITY;
  const right = b.nextFireTime ? Date.parse(b.nextFireTime) : Number.POSITIVE_INFINITY;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function matchesSearch(scheduling: SchedulingResponse, query: string): boolean {
  if (!query) return true;
  const haystack = [scheduling.name, scheduling.description ?? "", scheduling.taskName, scheduling.taskKey]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export interface SchedulingsTableProps {
  schedulings: SchedulingResponse[] | undefined;
  loading: boolean;
  fetching?: boolean;
  error: Error | null;
  onRetry: () => void;
  onCreate: () => void;
  onEdit: (scheduling: SchedulingResponse) => void;
}

/** The list of schedulings with inline enable/disable, edit and delete. */
export function SchedulingsTable({
  schedulings,
  loading,
  fetching = false,
  error,
  onRetry,
  onCreate,
  onEdit,
}: SchedulingsTableProps) {
  const { message, notification } = App.useApp();
  const updateMutation = useUpdateScheduling();
  const deleteMutation = useDeleteScheduling();
  const [togglingIds, setTogglingIds] = useState<ReadonlySet<string>>(new Set());
  const [search, setSearch] = useState("");
  const now = useNow();
  const screens = Grid.useBreakpoint();
  const showTask = Boolean(screens.md);
  const showParameters = Boolean(screens.xl);
  const localZone = useMemo(() => browserTimeZone(), []);

  const rows = useMemo(
    () => (schedulings ?? []).filter((scheduling) => matchesSearch(scheduling, search.trim())),
    [schedulings, search],
  );

  const setToggling = (id: string, active: boolean) =>
    setTogglingIds((previous) => {
      const next = new Set(previous);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });

  const handleToggle = async (scheduling: SchedulingResponse, enabled: boolean) => {
    setToggling(scheduling.id, true);
    try {
      await updateMutation.mutateAsync({ id: scheduling.id, request: toggleRequest(scheduling, enabled) });
      message.success(enabled ? `“${scheduling.name}” enabled` : `“${scheduling.name}” disabled`);
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        notification.warning({ title: "Not updated", description: CONFLICT_MESSAGE });
      } else {
        notification.error({
          title: `Could not ${enabled ? "enable" : "disable"} “${scheduling.name}”`,
          description: err instanceof Error ? err.message : undefined,
        });
      }
    } finally {
      setToggling(scheduling.id, false);
    }
  };

  const handleDelete = async (scheduling: SchedulingResponse) => {
    try {
      await deleteMutation.mutateAsync(scheduling.id);
      message.success(`“${scheduling.name}” deleted`);
    } catch (err) {
      if (err instanceof ApiError && err.isNotFound) {
        message.info(`“${scheduling.name}” was already deleted`);
        return;
      }
      notification.error({
        title: `Could not delete “${scheduling.name}”`,
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const columns: ColumnsType<SchedulingResponse> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      width: COLUMN_WIDTHS.name,
      render: (_, record) => (
        <Flex vertical style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis={{ tooltip: record.name }}>
            {record.name}
          </Typography.Text>
          {record.description && (
            <Typography.Text type="secondary" ellipsis={{ tooltip: record.description }} style={{ fontSize: 12 }}>
              {record.description}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      title: "Task",
      dataIndex: "taskName",
      key: "task",
      width: COLUMN_WIDTHS.task,
      responsive: ["md"],
      render: (taskName: string) => (
        <Tooltip title={taskName}>
          <Tag color="geekblue" style={ELLIPSIS_TAG_STYLE}>
            {taskName}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: "Schedule",
      key: "schedule",
      render: (_, record) => (
        <Flex gap={8} align="start" style={{ minWidth: 0 }}>
          <Typography.Text type="secondary" aria-hidden>
            {SCHEDULE_ICONS[record.schedule.type]}
          </Typography.Text>
          <Flex vertical style={{ minWidth: 0 }}>
            <span>{describeSchedule(record.schedule)}</span>
            {record.schedule.type === "CRON" && (
              <Typography.Text code ellipsis={{ tooltip: record.schedule.expression }} style={{ fontSize: 12 }}>
                {record.schedule.expression}
              </Typography.Text>
            )}
          </Flex>
        </Flex>
      ),
    },
    {
      title: "Parameters",
      key: "parameters",
      width: COLUMN_WIDTHS.parameters,
      responsive: ["xl"],
      render: (_, record) => <ParameterTags parameters={record.parameters} />,
    },
    {
      title: "Next run",
      key: "nextRun",
      sorter: compareNextRun,
      width: COLUMN_WIDTHS.nextRun,
      render: (_, record) => <NextRun scheduling={record} now={now} />,
    },
    {
      title: "Status",
      key: "status",
      width: COLUMN_WIDTHS.status,
      render: (_, record) => {
        const completed = record.status === "COMPLETED";
        const status = STATUS_TAGS[record.status] ?? STATUS_TAGS.ACTIVE;
        return (
          <Flex gap={8} align="center" wrap={false}>
            <Tooltip title={completed ? "Completed: edit the schedule to run it again" : record.enabled ? "Disable" : "Enable"}>
              <Switch
                size="small"
                checked={record.enabled}
                loading={togglingIds.has(record.id)}
                disabled={completed}
                aria-label={`Enabled: ${record.name}`}
                onChange={(checked) => void handleToggle(record, checked)}
              />
            </Tooltip>
            <Tag color={status.color} style={{ marginInlineEnd: 0 }}>
              {status.label}
            </Tag>
          </Flex>
        );
      },
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: "actions",
      width: COLUMN_WIDTHS.actions,
      align: "right",
      fixed: "right",
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} aria-label={`Edit ${record.name}`} onClick={() => onEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="Delete this scheduling?"
            description={`“${record.name}” will be removed and will no longer run.`}
            okText="Delete"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
            onConfirm={() => handleDelete(record)}
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Delete ${record.name}`} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const hasData = schedulings !== undefined;
  const isEmpty = hasData && schedulings.length === 0;

  let content: ReactNode;
  if (!hasData && loading) {
    content = (
      <div role="status" aria-label="Loading schedulings">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  } else if (!hasData && error) {
    content = (
      <Alert
        type="error"
        showIcon
        title="Couldn't load schedulings"
        description={error.message}
        action={
          <Button size="small" danger onClick={onRetry}>
            Retry
          </Button>
        }
      />
    );
  } else if (isEmpty) {
    content = (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Flex vertical gap={4}>
            <Typography.Text strong>No schedulings yet</Typography.Text>
            <Typography.Text type="secondary">
              Create one to run a task once, on an interval, weekly or on a cron schedule.
            </Typography.Text>
          </Flex>
        }
        style={{ padding: "32px 0" }}
      >
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          Create your first scheduling
        </Button>
      </Empty>
    );
  } else {
    content = (
      <>
        {error && (
          <Alert
            type="warning"
            showIcon
            title="Couldn't refresh the list; showing the last loaded data."
            action={
              <Button size="small" onClick={onRetry}>
                Retry
              </Button>
            }
            style={{ marginBottom: 12 }}
          />
        )}
        <Table<SchedulingResponse>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          size="middle"
          pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
          // A numeric minimum (not "max-content") so long text wraps inside the fixed column widths.
          scroll={{ x: tableMinWidth(showTask, showParameters) }}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`No schedulings match “${search.trim()}”`}>
                <Button onClick={() => setSearch("")}>Clear search</Button>
              </Empty>
            ),
          }}
        />
      </>
    );
  }

  return (
    <section className="schedulings-panel" aria-labelledby="schedulings-title">
      <Flex justify="space-between" align="center" wrap gap={12} className="schedulings-header">
        <div>
          <Typography.Title level={3} id="schedulings-title" style={{ margin: 0 }}>
            Schedulings
          </Typography.Title>
          <Typography.Text type="secondary">
            Run predefined tasks on a schedule. Times are shown in your local time zone ({localZone}).
          </Typography.Text>
        </div>
        <Flex gap={8} wrap align="center">
          {hasData && !isEmpty && (
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search name or task"
              aria-label="Search schedulings"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ width: 220 }}
            />
          )}
          <Tooltip title="Refresh">
            <Button icon={<ReloadOutlined spin={fetching} />} aria-label="Refresh" onClick={onRetry} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            New scheduling
          </Button>
        </Flex>
      </Flex>
      {content}
    </section>
  );
}
