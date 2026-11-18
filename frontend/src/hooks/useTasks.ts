"use client";

import { useQuery } from "@tanstack/react-query";
import { listTasks } from "@/api/client";

export const taskKeys = {
  all: ["tasks"] as const,
};

/** Tasks are predefined in backend code and never change at runtime, so they are fetched once. */
export function useTasks() {
  return useQuery({
    queryKey: taskKeys.all,
    queryFn: ({ signal }) => listTasks(signal),
    staleTime: Infinity,
  });
}
