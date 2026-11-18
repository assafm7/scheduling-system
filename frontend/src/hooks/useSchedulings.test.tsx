import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createScheduling,
  deleteScheduling,
  getScheduling,
  listSchedulings,
  listTasks,
  updateScheduling,
} from "@/api/client";
import type { SchedulingRequest } from "@/api/types";
import { makeScheduling, SCHEDULINGS, TASKS } from "@/test/fixtures";
import { createTestQueryClient } from "@/test/render";
import {
  schedulingKeys,
  useCreateScheduling,
  useDeleteScheduling,
  useFetchScheduling,
  useSchedulings,
  useUpdateScheduling,
} from "./useSchedulings";
import { useTasks } from "./useTasks";

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  listSchedulings: vi.fn(),
  listTasks: vi.fn(),
  getScheduling: vi.fn(),
  createScheduling: vi.fn(),
  updateScheduling: vi.fn(),
  deleteScheduling: vi.fn(),
}));

const listMock = vi.mocked(listSchedulings);

const request: SchedulingRequest = {
  name: "New",
  description: null,
  taskKey: "LOG",
  parameters: { message: "hi" },
  schedule: { type: "INTERVAL", every: 5, unit: "MINUTES", timeZone: "UTC" },
  enabled: true,
};

function setup() {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue(SCHEDULINGS);
});

describe("useSchedulings", () => {
  it("fetches the list and polls it", async () => {
    const { wrapper, queryClient } = setup();
    const { result } = renderHook(() => useSchedulings(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(SCHEDULINGS);
    expect(queryClient.getQueryCache().find({ queryKey: schedulingKeys.list() })?.options).toMatchObject({
      refetchInterval: 15_000,
    });
  });

  it("refetches the list after a create", async () => {
    const { wrapper } = setup();
    vi.mocked(createScheduling).mockResolvedValue(makeScheduling({ id: "new" }));
    const { result } = renderHook(() => ({ list: useSchedulings(), create: useCreateScheduling() }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(listMock).toHaveBeenCalledTimes(1);

    await act(() => result.current.create.mutateAsync(request));

    expect(createScheduling).toHaveBeenCalledWith(request);
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("applies an update to the cached list immediately and refetches", async () => {
    const { wrapper, queryClient } = setup();
    const updated = { ...SCHEDULINGS[0], enabled: false, status: "PAUSED" as const, version: 4 };
    vi.mocked(updateScheduling).mockResolvedValue(updated);
    const { result } = renderHook(() => ({ list: useSchedulings(), update: useUpdateScheduling() }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    // Hold the refetch so the optimistic cache write is observable.
    listMock.mockReturnValue(new Promise(() => {}));

    act(() => result.current.update.mutate({ id: updated.id, request: { ...request, version: 3 } }));

    await waitFor(() => expect(queryClient.getQueryData(schedulingKeys.list())).toContainEqual(updated));
    expect(updateScheduling).toHaveBeenCalledWith(updated.id, { ...request, version: 3 });
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("refetches the list even when an update fails with a conflict", async () => {
    const { wrapper } = setup();
    vi.mocked(updateScheduling).mockRejectedValue(new ApiError(409, "Conflict"));
    const { result } = renderHook(() => ({ list: useSchedulings(), update: useUpdateScheduling() }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(async () => {
      await expect(result.current.update.mutateAsync({ id: "x", request })).rejects.toBeInstanceOf(ApiError);
    });

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("refetches the list after a delete", async () => {
    const { wrapper } = setup();
    vi.mocked(deleteScheduling).mockResolvedValue(undefined);
    const { result } = renderHook(() => ({ list: useSchedulings(), remove: useDeleteScheduling() }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() => result.current.remove.mutateAsync("abc"));

    expect(deleteScheduling).toHaveBeenCalledWith("abc");
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("fetches a single scheduling on demand", async () => {
    const { wrapper } = setup();
    vi.mocked(getScheduling).mockResolvedValue(SCHEDULINGS[1]);
    const { result } = renderHook(() => useFetchScheduling(), { wrapper });

    await expect(result.current(SCHEDULINGS[1].id)).resolves.toEqual(SCHEDULINGS[1]);
    expect(getScheduling).toHaveBeenCalledWith(SCHEDULINGS[1].id, expect.any(AbortSignal));
  });
});

describe("useTasks", () => {
  it("loads the task catalogue", async () => {
    const { wrapper } = setup();
    vi.mocked(listTasks).mockResolvedValue(TASKS);
    const { result } = renderHook(() => useTasks(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((task) => task.key)).toEqual(["LOG", "EMAIL", "DB_REPORT"]);
  });
});
