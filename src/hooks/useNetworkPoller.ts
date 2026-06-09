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
 *
 * IPC branching logic → src/api/networkApi.ts (pollNetworkData)
 * Daily byte accumulation → useDailyUsageAccumulator hook
 * Interval management → useStoredInterval hook
 */
export function useNetworkPoller() {
  const setData = useNetworkStore((s) => s.setData);
  const setSnapshot = useNetworkStore((s) => s.setSnapshot);
  const setConnected = useNetworkStore((s) => s.setConnected);

  // Daily usage accumulation (handles day boundaries internally)
  const accumulate = useDailyUsageAccumulator();

  // Per-window poll intervals
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
        // FIX: Issue 8.1 — IPC branching extracted to networkApi
        const result = await pollNetworkData(WINDOW_LABEL);

        // Dispatch to appropriate store action
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

        // Accumulate today's usage estimate
        accumulate(result.currentUpload, result.currentDownload);
      } catch (err) {
        console.error("FluxNet poll error:", err);
        setConnected(false);
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
    setConnected,
    accumulate,
  ]);
}
