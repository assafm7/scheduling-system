"use client";

import { Skeleton } from "antd";
import dynamic from "next/dynamic";

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton active title={{ width: 200 }} paragraph={{ rows: 6 }} />
    </div>
  );
}

/**
 * The schedulings UI renders only in the browser: it formats times in the viewer's time zone and
 * defaults new schedules to it, which the server can't know. Skipping prerendering avoids hydration
 * mismatches and Cache Components' "current time during prerender" errors.
 */
export const ClientOnlySchedulingsPage = dynamic(() => import("./SchedulingsPage"), {
  ssr: false,
  loading: () => <PageSkeleton />,
});
