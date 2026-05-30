import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNetworkStore } from "../store/networkStore";
import {
  getStoredCompactIntervalMs,
  getStoredHudIntervalMs,
  getStoredPillIntervalMs,
  LS_COMPACT_INTERVAL,
  LS_HUD_INTERVAL,
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
  const addTodayUsage = useNetworkStore((s) => s.addTodayUsage);
  const resetTodayUsage = useNetworkStore((s) => s.resetTodayUsage);
  // Read the interval live from the store — changes in Settings take effect immediately
  const dashboardIntervalMs = useNetworkStore((s) => s.pollIntervalMs);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSampleAtRef = useRef<number | null>(null);
  const lastDayKeyRef = useRef<string>("" as string);
  const windowLabel = getCurrentWindow().label;
  const [pillIntervalMs, setPillIntervalMs] = useState(() =>
    getStoredPillIntervalMs(),
  );
  const [compactIntervalMs, setCompactIntervalMs] = useState(() =>
    getStoredCompactIntervalMs(),
  );
  const [hudIntervalMs, setHudIntervalMs] = useState(() =>
    getStoredHudIntervalMs(),
  );

  const getDayKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

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
    if (windowLabel !== "hud") return;

    const sync = () => setHudIntervalMs(getStoredHudIntervalMs());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LS_HUD_INTERVAL) sync();
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
        const now = Date.now();
        const dayKey = getDayKey();
        if (!lastDayKeyRef.current) {
          lastDayKeyRef.current = dayKey;
        }
        if (lastDayKeyRef.current !== dayKey) {
          resetTodayUsage();
          lastDayKeyRef.current = dayKey;
          lastSampleAtRef.current = now;
        }

        if (windowLabel === "pill" || windowLabel === "hud") {
          // Pill only needs current speeds — lightweight
          const stats = await invoke<RawStats>("get_network_stats");
          setData({
            uploadBytesPerSec: stats.upload_bytes_per_sec,
            downloadBytesPerSec: stats.download_bytes_per_sec,
            interfaceName: stats.interface_name,
          });

          if (lastSampleAtRef.current !== null) {
            const elapsedSec = (now - lastSampleAtRef.current) / 1000;
            if (elapsedSec > 0) {
              addTodayUsage(
                stats.upload_bytes_per_sec * elapsedSec,
                stats.download_bytes_per_sec * elapsedSec,
              );
            }
          }
          lastSampleAtRef.current = now;
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

          if (lastSampleAtRef.current !== null) {
            const elapsedSec = (now - lastSampleAtRef.current) / 1000;
            if (elapsedSec > 0) {
              addTodayUsage(
                snap.current_upload * elapsedSec,
                snap.current_download * elapsedSec,
              );
            }
          }
          lastSampleAtRef.current = now;
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
        : windowLabel === "hud"
          ? hudIntervalMs
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
    hudIntervalMs,
    pillIntervalMs,
    windowLabel,
    addTodayUsage,
    resetTodayUsage,
    setData,
    setConnected,
    setSnapshot,
  ]);
}
