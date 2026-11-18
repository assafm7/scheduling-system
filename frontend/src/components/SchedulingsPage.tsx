"use client";

import { useRef, useState } from "react";
import type { SchedulingResponse } from "@/api/types";
import { useSchedulings } from "@/hooks/useSchedulings";
import { SchedulingFormModal } from "./SchedulingFormModal";
import { SchedulingsTable } from "./SchedulingsTable";

interface ModalState {
  /** Fresh key per opening, so every form starts from a clean instance. */
  key: number;
  scheduling: SchedulingResponse | null;
}

/** The main screen: the schedulings list plus the create/edit modal. */
export function SchedulingsPage() {
  const query = useSchedulings();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [open, setOpen] = useState(false);
  const nextKey = useRef(0);

  const openModal = (scheduling: SchedulingResponse | null) => {
    nextKey.current += 1;
    setModal({ key: nextKey.current, scheduling });
    setOpen(true);
  };

  return (
    <>
      <SchedulingsTable
        schedulings={query.data}
        loading={query.isPending}
        fetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onCreate={() => openModal(null)}
        onEdit={(scheduling) => openModal(scheduling)}
      />
      {modal && (
        <SchedulingFormModal
          key={modal.key}
          open={open}
          scheduling={modal.scheduling}
          onClose={() => setOpen(false)}
          afterClose={() => setModal(null)}
        />
      )}
    </>
  );
}

export default SchedulingsPage;
