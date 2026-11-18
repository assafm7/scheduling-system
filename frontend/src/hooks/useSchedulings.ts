"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createScheduling,
  deleteScheduling,
  getScheduling,
  listSchedulings,
  updateScheduling,
} from "@/api/client";
import type { SchedulingRequest, SchedulingResponse } from "@/api/types";

export const schedulingKeys = {
  all: ["schedulings"] as const,
  list: () => [...schedulingKeys.all, "list"] as const,
  detail: (id: string) => [...schedulingKeys.all, "detail", id] as const,
};

/** Polling keeps "next run" and status fresh as jobs fire in the background. */
export const SCHEDULINGS_REFETCH_INTERVAL_MS = 15_000;

export function useSchedulings() {
  return useQuery({
    queryKey: schedulingKeys.list(),
    queryFn: ({ signal }) => listSchedulings(signal),
    refetchInterval: SCHEDULINGS_REFETCH_INTERVAL_MS,
  });
}

/** Imperative fetch of the latest copy of one scheduling (e.g. to reload after a 409). */
export function useFetchScheduling() {
  const queryClient = useQueryClient();
  return (id: string) =>
    queryClient.fetchQuery({
      queryKey: schedulingKeys.detail(id),
      queryFn: ({ signal }) => getScheduling(id, signal),
      staleTime: 0,
    });
}

function useInvalidateSchedulings() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: schedulingKeys.all });
}

export function useCreateScheduling() {
  const invalidate = useInvalidateSchedulings();
  return useMutation({
    mutationFn: (request: SchedulingRequest) => createScheduling(request),
    onSettled: invalidate,
  });
}

export interface UpdateSchedulingVariables {
  id: string;
  request: SchedulingRequest;
}

export function useUpdateScheduling() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateSchedulings();
  return useMutation({
    mutationFn: ({ id, request }: UpdateSchedulingVariables) => updateScheduling(id, request),
    onSuccess: (updated) => {
      // Show the new state (e.g. a toggled switch) immediately, before the refetch lands.
      queryClient.setQueryData<SchedulingResponse[]>(schedulingKeys.list(), (current) =>
        current?.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
    // Also on error: a 409 means our copy is stale, so refetch it.
    onSettled: invalidate,
  });
}

export function useDeleteScheduling() {
  const invalidate = useInvalidateSchedulings();
  return useMutation({
    mutationFn: (id: string) => deleteScheduling(id),
    onSettled: invalidate,
  });
}
