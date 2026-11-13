import { useEffect, useState } from "react";
import { WINDOW_LABEL } from "@/api";
import { clampPollInterval } from "@/utils";

/**
 * Syncs a polling interval from localStorage for a specific window label.
 * The value is clamped to the supported 500–5000 ms range.
 */
export function useStoredInterval(
  targetLabel: string,
  lsKey: string,
  getStored: () => number,
): number {
  const [intervalMs, setIntervalMs] = useState(() =>
    clampPollInterval(getStored()),
  );

  useEffect(() => {
    if (WINDOW_LABEL !== targetLabel) return;

    const sync = () => setIntervalMs(clampPollInterval(getStored()));
    const handleStorage = (e: StorageEvent) => {
      if (e.key === lsKey) sync();
    };

    sync();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [targetLabel, lsKey, getStored]);

  return intervalMs;
}
