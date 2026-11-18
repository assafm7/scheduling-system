import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, ConfigProvider } from "antd";
import type { ReactElement, ReactNode } from "react";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

interface ProviderOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
}

export function TestProviders({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* No motion: modals and popovers open/close synchronously, keeping tests fast and deterministic. */}
      <ConfigProvider theme={{ token: { motion: false } }}>
        <App>{children}</App>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

/** Renders with React Query, antd ConfigProvider and App (message/notification) like the real app. */
export function renderWithProviders(ui: ReactElement, { queryClient = createTestQueryClient(), ...options }: ProviderOptions = {}) {
  // No artificial delay between keystrokes: keeps typing-heavy form tests fast.
  const user = userEvent.setup({ delay: null });
  const result = render(ui, {
    wrapper: ({ children }) => <TestProviders queryClient={queryClient}>{children}</TestProviders>,
    ...options,
  });
  return { user, queryClient, ...result };
}
