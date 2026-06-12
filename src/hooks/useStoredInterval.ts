import { useEffect, useState } from "react";
import { WINDOW_LABEL } from "@/api";

/**
 * Syncs a polling interval from localStorage for a specific window label.
 */
export function useStoredInterval(
  targetLabel: string,
  lsKey: string,
  getStored: () => number,
): number {
  const [intervalMs, setIntervalMs] = useState(getStored);

  useEffect(() => {
    if (WINDOW_LABEL !== targetLabel) return;

    const sync = () => setIntervalMs(getStored());
    const handleStorage = (e: StorageEvent) => {
      if (e.key === lsKey) sync();
    };

    sync();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [targetLabel, lsKey, getStored]);

  return intervalMs;
}
