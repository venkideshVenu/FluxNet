import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Syncs a polling interval from localStorage for a specific window label.
 * Only activates if the current window matches the target label.
 * Listens for StorageEvents to react to cross-window changes.
 *
 * @param targetLabel - The window label this interval applies to (e.g., "pill")
 * @param lsKey - The localStorage key storing the interval value
 * @param getStored - Function that reads and parses the stored interval
 * @returns The current interval in milliseconds
 */
export function useStoredInterval(
  targetLabel: string,
  lsKey: string,
  getStored: () => number,
): number {
  const [intervalMs, setIntervalMs] = useState(getStored);

  useEffect(() => {
    const windowLabel = getCurrentWindow().label;
    if (windowLabel !== targetLabel) return;

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
