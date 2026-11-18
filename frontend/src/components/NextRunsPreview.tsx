"use client";

import { FieldTimeOutlined } from "@ant-design/icons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Flex, Skeleton, Typography } from "antd";
import { useMemo, type ReactNode } from "react";
import { ApiError, previewSchedule } from "@/api/client";
import type { ScheduleSpec } from "@/api/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useNow } from "@/hooks/useNow";
import dayjs from "@/utils/dayjs";
import { describeSchedule } from "@/utils/describeSchedule";
import { browserTimeZone } from "@/utils/timeZones";

export const PREVIEW_DEBOUNCE_MS = 400;

function previewErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const fieldMessages = Object.values(error.fieldErrors);
    if (error.isValidation && fieldMessages.length > 0) return fieldMessages.join(" ");
    return error.message;
  }
  return "The preview is unavailable right now.";
}

interface NextRunsPreviewProps {
  /** The schedule currently described by the form, or null while it is incomplete. */
  spec: ScheduleSpec | null;
}

/** Asks the backend (debounced) when the schedule would fire next and lists those times in local time. */
export function NextRunsPreview({ spec }: NextRunsPreviewProps) {
  const specKey = spec ? JSON.stringify(spec) : null;
  const debouncedKey = useDebouncedValue(specKey, PREVIEW_DEBOUNCE_MS);
  const debouncedSpec = useMemo(() => (debouncedKey ? (JSON.parse(debouncedKey) as ScheduleSpec) : null), [debouncedKey]);
  const now = useNow();
  const localZone = useMemo(() => browserTimeZone(), []);

  const query = useQuery({
    queryKey: ["schedule-preview", debouncedKey],
    queryFn: ({ signal }) => previewSchedule(debouncedSpec as ScheduleSpec, signal),
    enabled: debouncedSpec !== null,
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const settling = specKey !== debouncedKey || query.isFetching;

  let body: ReactNode;
  if (!spec) {
    body = (
      <Typography.Text type="secondary">Complete the schedule to see when it will run.</Typography.Text>
    );
  } else if (query.isError && !settling) {
    body = (
      <Alert
        type="warning"
        showIcon
        title={previewErrorMessage(query.error)}
        data-testid="preview-error"
      />
    );
  } else if (!query.data) {
    body = <Skeleton active title={false} paragraph={{ rows: 3 }} aria-label="Loading preview" />;
  } else if (query.data.nextFireTimes.length === 0) {
    body = <Typography.Text type="secondary">This schedule has no upcoming runs.</Typography.Text>;
  } else {
    body = (
      <ol className="next-runs-list" style={{ opacity: settling ? 0.55 : 1 }} aria-busy={settling}>
        {query.data.nextFireTimes.map((time) => {
          const instant = dayjs(time);
          const zone = spec.timeZone;
          return (
            <li key={time}>
              <Typography.Text strong>{instant.format("ddd, MMM D, YYYY HH:mm")}</Typography.Text>{" "}
              <Typography.Text type="secondary">· {instant.from(now)}</Typography.Text>
              {zone !== localZone && (
                <Typography.Text type="secondary">
                  {" "}
                  · {instant.tz(zone).format("HH:mm")} in {zone}
                </Typography.Text>
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <section className="next-runs" aria-label="Next runs preview" aria-live="polite">
      <Flex justify="space-between" align="baseline" wrap gap={8} style={{ marginBottom: 8 }}>
        <Typography.Text strong>
          <FieldTimeOutlined /> Next runs
        </Typography.Text>
        {spec && (
          <Typography.Text type="secondary" data-testid="schedule-summary">
            {describeSchedule(spec)}
          </Typography.Text>
        )}
      </Flex>
      {body}
      <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
        Shown in your local time ({localZone}).
      </Typography.Text>
    </section>
  );
}
