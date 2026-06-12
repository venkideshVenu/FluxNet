import { useEffect, useRef } from "react";
import { WINDOW_LABEL, fetchPingStats } from "@/api";
import { usePingStore } from "@/store";

/**
 * Polls get_ping_stats every intervalMs.
 * Internally guards against non-HUD windows.
 */
export function usePingPoller(intervalMs = 2000) {
  const setStats = usePingStore((s) => s.setStats);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (WINDOW_LABEL !== "hud") {
      return;
    }

    const poll = async () => {
      try {
        const raw = await fetchPingStats();
        setStats({
          // Backend uses -1 for timeout; frontend uses null
          latencyMs: raw.latency_ms < 0 ? null : raw.latency_ms,
          lossPercent: raw.loss_percent,
        });
      } catch (err) {
        console.error("Ping poll error:", err);
      }
    };

    poll();
    timerRef.current = setInterval(poll, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [intervalMs, setStats]);
}
