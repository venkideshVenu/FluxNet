import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePingStore } from "@/store/pingStore";

type RawPingStats = {
  latency_ms: number;
  loss_percent: number;
};

/**
 * Polls get_ping_stats every intervalMs.
 * Only mount this in the HUD window — ping costs a real network round-trip.
 */
export function usePingPoller(intervalMs = 2000) {
  const setStats = usePingStore((s) => s.setStats);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const raw = await invoke<RawPingStats>("get_ping_stats");
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
