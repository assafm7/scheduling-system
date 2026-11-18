"use client";

import { useEffect, useState } from "react";

/** Current timestamp that ticks every `intervalMs`, so relative times ("in 5 minutes") stay accurate. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
