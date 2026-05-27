import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkStore } from "../store/networkStore";

type RawStats = {
  upload_bytes_per_sec: number;
  download_bytes_per_sec: number;
  interface_name: string;
};

/**
 * Polls the Rust backend every `intervalMs` milliseconds.
 * Writes results directly into the Zustand store.
 * Call this once at the app root.
 */
export function useNetworkPoller(intervalMs = 1000) {
  const setData = useNetworkStore((s) => s.setData);
  const setConnected = useNetworkStore((s) => s.setConnected);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const stats = await invoke<RawStats>("get_network_stats");
        setData({
          uploadBytesPerSec: stats.upload_bytes_per_sec,
          downloadBytesPerSec: stats.download_bytes_per_sec,
          interfaceName: stats.interface_name,
        });
      } catch (err) {
        console.error("FluxNet poll error:", err);
        setConnected(false);
      }
    };

    // Poll immediately, then on interval
    poll();
    timerRef.current = setInterval(poll, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [intervalMs, setData, setConnected]);
}
