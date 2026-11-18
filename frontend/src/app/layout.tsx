import { AntdRegistry } from "@ant-design/nextjs-registry";
import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scheduler",
  description: "Schedule predefined tasks to run once, on an interval, weekly or by cron expression.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {/*
          antd's style registry seeds its cache with Math.random(), which Cache Components refuses to
          prerender into the static shell. The Suspense boundary renders it per request instead.
        */}
        <Suspense fallback={null}>
          <AntdRegistry>
            <Providers>{children}</Providers>
          </AntdRegistry>
        </Suspense>
      </body>
    </html>
  );
}
