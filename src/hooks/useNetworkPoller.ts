import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNetworkStore } from "../store/networkStore";
import {
  getStoredCompactIntervalMs,
  getStoredPillIntervalMs,
  LS_COMPACT_INTERVAL,
  LS_PILL_INTERVAL,
} from "../utils/polling";

type RawStats = {
  upload_bytes_per_sec: number;
  download_bytes_per_sec: number;
  interface_name: string;
};

type RawSnapshot = {
  current_upload: number;
  current_download: number;
  peak_upload: number;
  peak_download: number;
  interface_name: string;
  history: { upload: number; download: number; t: number }[];
};

export function useNetworkPoller() {
  const setData = useNetworkStore((s) => s.setData);
  const setConnected = useNetworkStore((s) => s.setConnected);
  const setSnapshot = useNetworkStore((s) => s.setSnapshot);
  // Read the interval live from the store — changes in Settings take effect immediately
  const dashboardIntervalMs = useNetworkStore((s) => s.pollIntervalMs);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const windowLabel = getCurrentWindow().label;
  const [pillIntervalMs, setPillIntervalMs] = useState(() =>
    getStoredPillIntervalMs(),
  );
  const [compactIntervalMs, setCompactIntervalMs] = useState(() =>
    getStoredCompactIntervalMs(),
  );

  useEffect(() => {
    if (windowLabel !== "pill") return;

    const sync = () => setPillIntervalMs(getStoredPillIntervalMs());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LS_PILL_INTERVAL) sync();
    };

    sync();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [windowLabel]);

  useEffect(() => {
    if (windowLabel !== "compact") return;

    const sync = () => setCompactIntervalMs(getStoredCompactIntervalMs());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LS_COMPACT_INTERVAL) sync();
    };

    sync();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [windowLabel]);

  useEffect(() => {
    const poll = async () => {
      try {
        if (windowLabel === "pill") {
          // Pill only needs current speeds — lightweight
          const stats = await invoke<RawStats>("get_network_stats");
          setData({
            uploadBytesPerSec: stats.upload_bytes_per_sec,
            downloadBytesPerSec: stats.download_bytes_per_sec,
            interfaceName: stats.interface_name,
          });
        } else {
          // Compact + main need history for charts
          const snap = await invoke<RawSnapshot>("get_dashboard_snapshot");
          setSnapshot({
            currentUpload: snap.current_upload,
            currentDownload: snap.current_download,
            peakUpload: snap.peak_upload,
            peakDownload: snap.peak_download,
            interfaceName: snap.interface_name,
            history: snap.history,
          });
        }
      } catch (err) {
        console.error("FluxNet poll error:", err);
        setConnected(false);
      }
    };

    poll();
    const intervalMs =
      windowLabel === "pill"
        ? pillIntervalMs
        : windowLabel === "compact"
          ? compactIntervalMs
          : dashboardIntervalMs;
    timerRef.current = setInterval(poll, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // Re-run whenever the interval changes — clears the old timer and starts a new one
  }, [
    dashboardIntervalMs,
    compactIntervalMs,
    pillIntervalMs,
    windowLabel,
    setData,
    setConnected,
    setSnapshot,
  ]);
}
