import { useEffect, useRef } from "react";
import { WINDOW_LABEL } from "@/api/tauri";
import { usePingStore } from "@/store";
import { fetchPingStats } from "@/api";

/**
 * Polls get_ping_stats every intervalMs.
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
          latencyMs: raw.latency_ms,
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
