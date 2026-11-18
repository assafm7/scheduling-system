"use client";

import { ScheduleOutlined } from "@ant-design/icons";
import { Flex, Layout, Typography } from "antd";
import type { ReactNode } from "react";

/** Static chrome around the app: a top bar with the product name and a centered content column. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Layout className="app-layout">
      <Layout.Header className="app-header">
        <Flex align="center" gap={10} className="app-container">
          <span className="app-logo" aria-hidden>
            <ScheduleOutlined />
          </span>
          <Typography.Text strong className="app-title">
            Scheduler
          </Typography.Text>
        </Flex>
      </Layout.Header>
      {/* Layout.Content renders the <main> landmark. */}
      <Layout.Content>
        <div className="app-container app-main">{children}</div>
      </Layout.Content>
    </Layout>
  );
}
