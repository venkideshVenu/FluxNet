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

// Every window uses the same full snapshot — this is the single source of truth.
// get_network_stats is no longer used; get_dashboard_snapshot returns current
// speeds, peaks, and history in one read from the backend's cached state.
type RawSnapshot = {
  current_upload: number;
  current_download: number;
  peak_upload: number;
  peak_download: number;
  interface_name: string;
  history: { upload: number; download: number; t: number }[];
};

export function useNetworkPoller() {
  const setSnapshot = useNetworkStore((s) => s.setSnapshot);
  const setConnected = useNetworkStore((s) => s.setConnected);
  const addTodayUsage = useNetworkStore((s) => s.addTodayUsage);
  const resetTodayUsage = useNetworkStore((s) => s.resetTodayUsage);

  // Per-window poll intervals
  const dashboardIntervalMs = useNetworkStore((s) => s.pollIntervalMs);
  const [pillIntervalMs, setPillIntervalMs] = useState(() =>
    getStoredPillIntervalMs(),
  );
  const [compactIntervalMs, setCompactIntervalMs] = useState(() =>
    getStoredCompactIntervalMs(),
  );
  const [hudIntervalMs, setHudIntervalMs] = useState(() =>
    getStoredHudIntervalMs(),
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSampleAtRef = useRef<number | null>(null);
  const lastDayKeyRef = useRef<string>("");
  const windowLabel = getCurrentWindow().label;

  const getDayKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  // ── Sync per-window intervals from localStorage ──────────────────────────

  useEffect(() => {
    if (windowLabel !== "pill") return;
    const sync = () => setPillIntervalMs(getStoredPillIntervalMs());
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_PILL_INTERVAL) sync();
    };
    sync();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [windowLabel]);

  useEffect(() => {
    if (windowLabel !== "hud") return;
    const sync = () => setHudIntervalMs(getStoredHudIntervalMs());
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_HUD_INTERVAL) sync();
    };
    sync();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [windowLabel]);

  useEffect(() => {
    if (windowLabel !== "compact") return;
    const sync = () => setCompactIntervalMs(getStoredCompactIntervalMs());
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_COMPACT_INTERVAL) sync();
    };
    sync();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [windowLabel]);

  // ── Main polling loop ─────────────────────────────────────────────────────
  //
  // All windows call get_dashboard_snapshot — the single Tauri command that
  // returns current speeds, peaks, and history from the backend's cache.
  // The background Rust task is the only thing that ever samples the NIC;
  // these frontend polls are pure reads.

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

        const snap = await invoke<RawSnapshot>("get_dashboard_snapshot");

        setSnapshot({
          currentUpload: snap.current_upload,
          currentDownload: snap.current_download,
          peakUpload: snap.peak_upload,
          peakDownload: snap.peak_download,
          interfaceName: snap.interface_name,
          history: snap.history,
        });

        // Accumulate today's usage estimate using elapsed wall-clock time.
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
    addTodayUsage,
    resetTodayUsage,
    setSnapshot,
    setConnected,
  ]);
}