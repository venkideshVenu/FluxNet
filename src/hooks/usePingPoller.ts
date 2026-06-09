import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { usePingStore } from "@/store";
import { fetchPingStats } from "@/api";

const WINDOW_LABEL = getCurrentWindow().label;

export function usePingPoller(intervalMs = 2000) {
  const setStats = usePingStore((s) => s.setStats);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // FIX: Issue 8.3 — Internal guard: only run in HUD window
    if (WINDOW_LABEL !== "hud") {
      return;
    }

    const poll = async () => {
      try {
        // FIX: Issue 6.3 — Uses fetchPingStats (has timeout via invokeWithTimeout)
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
