import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNetworkStore } from "@/store";
import {
  getStoredCompactIntervalMs,
  getStoredHudIntervalMs,
  getStoredPillIntervalMs,
  LS_COMPACT_INTERVAL,
  LS_HUD_INTERVAL,
  LS_PILL_INTERVAL,
} from "@/utils/polling";
import { useStoredInterval } from "@/hooks";

// Dashboard and Compact use the full snapshot.
// Pill and HUD use the lighter live-stats path because they only need the
// current upload/download values.
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
  const setSnapshot = useNetworkStore((s) => s.setSnapshot);
  const setConnected = useNetworkStore((s) => s.setConnected);
  const addTodayUsage = useNetworkStore((s) => s.addTodayUsage);
  const resetTodayUsage = useNetworkStore((s) => s.resetTodayUsage);

  // Per-window poll intervals — FIX Issue 2.1: consolidated via useStoredInterval
  const dashboardIntervalMs = useNetworkStore((s) => s.pollIntervalMs);
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
  const lastSampleAtRef = useRef<number | null>(null);
  const lastDayKeyRef = useRef<string>("");
  const windowLabel = getCurrentWindow().label;

  const getDayKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  // ── Main polling loop ─────────────────────────────────────────────────────

  useEffect(() => {
    const poll = async () => {
      try {
        const now = Date.now();
        const dayKey = getDayKey();
        let currentUpload = 0;
        let currentDownload = 0;

        if (!lastDayKeyRef.current) {
          lastDayKeyRef.current = dayKey;
        }
        if (lastDayKeyRef.current !== dayKey) {
          resetTodayUsage();
          lastDayKeyRef.current = dayKey;
          lastSampleAtRef.current = now;
        }

        if (windowLabel === "pill" || windowLabel === "hud") {
          const stats = await invoke<{
            upload_bytes_per_sec: number;
            download_bytes_per_sec: number;
            interface_name: string;
          }>("get_network_stats");

          currentUpload = stats.upload_bytes_per_sec;
          currentDownload = stats.download_bytes_per_sec;

          setData({
            uploadBytesPerSec: stats.upload_bytes_per_sec,
            downloadBytesPerSec: stats.download_bytes_per_sec,
            interfaceName: stats.interface_name,
          });
        } else {
          const snap = await invoke<RawSnapshot>("get_dashboard_snapshot");

          currentUpload = snap.current_upload;
          currentDownload = snap.current_download;

          setSnapshot({
            currentUpload: snap.current_upload,
            currentDownload: snap.current_download,
            peakUpload: snap.peak_upload,
            peakDownload: snap.peak_download,
            interfaceName: snap.interface_name,
            history: snap.history,
          });
        }

        // Accumulate today's usage estimate using elapsed wall-clock time.
        if (lastSampleAtRef.current !== null) {
          const elapsedSec = (now - lastSampleAtRef.current) / 1000;
          if (elapsedSec > 0) {
            addTodayUsage(
              currentUpload * elapsedSec,
              currentDownload * elapsedSec,
            );
          }
        }
        lastSampleAtRef.current = now;
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
  }, [
    dashboardIntervalMs,
    compactIntervalMs,
    hudIntervalMs,
    pillIntervalMs,
    windowLabel,
    setData,
    addTodayUsage,
    resetTodayUsage,
    setSnapshot,
    setConnected,
  ]);
}
