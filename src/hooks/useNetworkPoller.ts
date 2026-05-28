import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNetworkStore } from "../store/networkStore";

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

export function useNetworkPoller(intervalMs = 1000) {
  const setData     = useNetworkStore((s) => s.setData);
  const setConnected= useNetworkStore((s) => s.setConnected);
  const setSnapshot = useNetworkStore((s) => s.setSnapshot);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const windowLabel = getCurrentWindow().label;

  useEffect(() => {
    const poll = async () => {
      try {
        if (windowLabel === "pill") {
          // Pill only needs current speeds
          const stats = await invoke<RawStats>("get_network_stats");
          setData({
            uploadBytesPerSec: stats.upload_bytes_per_sec,
            downloadBytesPerSec: stats.download_bytes_per_sec,
            interfaceName: stats.interface_name,
          });
        } else {
          // Dashboard gets the full snapshot including history + peaks
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
    timerRef.current = setInterval(poll, intervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [intervalMs, windowLabel, setData, setConnected, setSnapshot]);
}