import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNetworkStore } from "@/store";
import { useSettingsStore } from "@/store";
import { pollNetworkData } from "@/api";
import {
  getStoredCompactIntervalMs,
  getStoredHudIntervalMs,
  getStoredPillIntervalMs,
  LS_COMPACT_INTERVAL,
  LS_HUD_INTERVAL,
  LS_PILL_INTERVAL,
} from "@/utils/polling";
import { useStoredInterval } from "@/hooks/useStoredInterval";
import { useDailyUsageAccumulator } from "@/hooks/useDailyUsageAccumulator";

const WINDOW_LABEL = getCurrentWindow().label;

/**
 * Core polling hook — thin coordinator.
 * 1. Determine correct poll interval for this window
 * 2. Run the poll loop on a timer
 * 3. Dispatch results to the correct store actions
 */
export function useNetworkPoller() {
  const setData = useNetworkStore((s) => s.setData);
  const setSnapshot = useNetworkStore((s) => s.setSnapshot);
  const setError = useNetworkStore((s) => s.setError);

  const accumulate = useDailyUsageAccumulator();

  const dashboardIntervalMs = useSettingsStore((s) => s.pollIntervalMs);
  const pillIntervalMs = useStoredInterval(
    "pill",
    LS_PILL_INTERVAL,
    getStoredPillIntervalMs,
  );
  const compactIntervalMs = useStoredInterval(
    "compact",
    LS_COMPACT_INTERVAL,
    getStoredCompactIntervalMs,
  );
  const hudIntervalMs = useStoredInterval(
    "hud",
    LS_HUD_INTERVAL,
    getStoredHudIntervalMs,
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const result = await pollNetworkData(WINDOW_LABEL);

        if (result.liveData) {
          setData(result.liveData);
        }
        if (result.snapshot) {
          setSnapshot({
            currentUpload: result.currentUpload,
            currentDownload: result.currentDownload,
            peakUpload: result.snapshot.peakUpload,
            peakDownload: result.snapshot.peakDownload,
            interfaceName: result.snapshot.interfaceName,
            isConnected: result.snapshot.isConnected,
            history: result.snapshot.history,
          });
        }

        accumulate(result.currentUpload, result.currentDownload);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to poll network data";
        console.error("FluxNet poll error:", err);
        setError(message);
      }
    };

    poll();

    const intervalMs =
      WINDOW_LABEL === "pill"
        ? pillIntervalMs
        : WINDOW_LABEL === "hud"
          ? hudIntervalMs
          : WINDOW_LABEL === "compact"
            ? compactIntervalMs
            : dashboardIntervalMs;

    timerRef.current = setInterval(poll, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    dashboardIntervalMs,
    compactIntervalMs,
    hudIntervalMs,
    pillIntervalMs,
    setData,
    setSnapshot,
    setError,
    accumulate,
  ]);
}
