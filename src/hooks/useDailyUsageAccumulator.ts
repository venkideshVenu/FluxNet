import { useRef, useCallback } from "react";
import { useNetworkStore } from "@/store";

/**
 * Manages daily usage accumulation and day boundary resets.
 * Returns an `accumulate` function that should be called after each successful poll
 * with the current upload/download bytes-per-second.
 */
export function useDailyUsageAccumulator() {
  const addTodayUsage = useNetworkStore((s) => s.addTodayUsage);
  const resetTodayUsage = useNetworkStore((s) => s.resetTodayUsage);

  const lastSampleAtRef = useRef<number | null>(null);
  const lastDayKeyRef = useRef<string>("");

  const getDayKey = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  /**
   * Call after each successful poll with current upload/download bps.
   * Handles day boundary detection and byte accumulation.
   */
  const accumulate = useCallback(
    (currentUploadBps: number, currentDownloadBps: number) => {
      const now = Date.now();
      const dayKey = getDayKey();

      // Initialize day key on first call
      if (!lastDayKeyRef.current) {
        lastDayKeyRef.current = dayKey;
      }

      // Detect day boundary crossing
      if (lastDayKeyRef.current !== dayKey) {
        resetTodayUsage();
        lastDayKeyRef.current = dayKey;
        lastSampleAtRef.current = now;
        return;
      }

      // Accumulate bytes based on elapsed wall-clock time since last sample
      if (lastSampleAtRef.current !== null) {
        const elapsedSec = (now - lastSampleAtRef.current) / 1000;
        if (elapsedSec > 0 && elapsedSec < 30) {
          // Guard against huge gaps (e.g., machine sleep)
          addTodayUsage(
            currentUploadBps * elapsedSec,
            currentDownloadBps * elapsedSec,
          );
        }
      }

      lastSampleAtRef.current = now;
    },
    [addTodayUsage, resetTodayUsage],
  );

  return accumulate;
}
