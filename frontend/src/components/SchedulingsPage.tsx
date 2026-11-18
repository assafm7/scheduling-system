"use client";

import { useSchedulings } from "@/hooks/useSchedulings";
import { SchedulingsTable } from "./SchedulingsTable";

/** The main screen: the schedulings list (the create/edit form follows in the next milestone). */
export function SchedulingsPage() {
  const query = useSchedulings();

  return (
    <SchedulingsTable
      schedulings={query.data}
      loading={query.isPending}
      fetching={query.isFetching}
      error={query.error}
      onRetry={() => void query.refetch()}
      onCreate={() => undefined}
      onEdit={() => undefined}
    />
  );
}

export default SchedulingsPage;
