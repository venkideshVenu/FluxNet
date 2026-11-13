import { useEffect } from "react";
import { WINDOW_LABEL, pollNetworkData } from "@/api";
import { useNetworkStore, useSettingsStore } from "@/store";
import {
  clampPollInterval,
  getStoredCompactIntervalMs,
  getStoredHudIntervalMs,
  getStoredPillIntervalMs,
  LS_COMPACT_INTERVAL,
  LS_HUD_INTERVAL,
  LS_PILL_INTERVAL,
} from "@/utils";
import { useStoredInterval, useDailyUsageAccumulator } from "@/hooks";

/**
 * Core polling hook — thin coordinator.
 * Pauses polling when the document is hidden to save resources.
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

  useEffect(() => {
    // Polls are chained (the next one is scheduled after the previous one
    // settles), so a slow backend can never leave several requests in flight
    // and an older response can never overwrite a newer one. `cancelled`
    // drops results that arrive after unmount or an interval change.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const intervalMs = clampPollInterval(
      WINDOW_LABEL === "pill"
        ? pillIntervalMs
        : WINDOW_LABEL === "hud"
          ? hudIntervalMs
          : WINDOW_LABEL === "compact"
            ? compactIntervalMs
            : dashboardIntervalMs,
    );

    const poll = async () => {
      try {
        const result = await pollNetworkData(WINDOW_LABEL);
        if (cancelled) return;

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
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to poll network data";
        console.error("FluxNet poll error:", err);
        setError(message);
      }
    };

    const tick = async () => {
      // The hidden dashboard skips work; widgets stay live while visible.
      if (!(WINDOW_LABEL === "main" && document.hidden)) {
        await poll();
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    tick();

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
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
