"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntdApp, ConfigProvider, type ThemeConfig } from "antd";
import enUS from "antd/locale/en_US";
import type { ReactNode } from "react";
import { ApiError } from "@/api/client";

export const theme: ThemeConfig = {
  token: {
    colorPrimary: "#4f46e5",
    colorInfo: "#4f46e5",
    borderRadius: 8,
    colorBgLayout: "#f5f6fa",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  },
  components: {
    Layout: { headerBg: "#ffffff", headerPadding: "0 24px", headerHeight: 60 },
    Table: { headerBg: "#fafafb" },
  },
};

/** Client errors (4xx) won't succeed on retry; network and server errors get one more attempt. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 5_000 },
      mutations: { retry: false },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  // Isolated per server render; one shared client in the browser (pattern from the Next.js TanStack guide).
  if (typeof window === "undefined") return createQueryClient();
  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <ConfigProvider theme={theme} locale={enUS}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
