import { invokeWithTimeout } from "@/utils";

export type RawNetworkStats = {
  upload_bytes_per_sec: number;
  download_bytes_per_sec: number;
  interface_name: string;
};

export type RawDashboardSnapshot = {
  current_upload: number;
  current_download: number;
  peak_upload: number;
  peak_download: number;
  interface_name: string;
  is_connected: boolean;
  history: { upload: number; download: number; t: number }[];
};

export type RawPingStats = {
  latency_ms: number;
  loss_percent: number;
};

export async function fetchNetworkStats(): Promise<RawNetworkStats> {
  return invokeWithTimeout<RawNetworkStats>("get_network_stats");
}

export async function fetchDashboardSnapshot(): Promise<RawDashboardSnapshot> {
  return invokeWithTimeout<RawDashboardSnapshot>("get_dashboard_snapshot");
}

export async function fetchPingStats(): Promise<RawPingStats> {
  return invokeWithTimeout<RawPingStats>("get_ping_stats");
}

export type NormalizedPollResult = {
  currentUpload: number;
  currentDownload: number;
  snapshot?: {
    peakUpload: number;
    peakDownload: number;
    interfaceName: string;
    isConnected: boolean;
    history: { upload: number; download: number; t: number }[];
  };
  liveData?: {
    uploadBytesPerSec: number;
    downloadBytesPerSec: number;
    interfaceName: string;
  };
};

export async function pollNetworkData(
  windowLabel: string,
): Promise<NormalizedPollResult> {
  // Widgets only show the current rate, so they use the light stats call.
  // Only the dashboard needs peaks and the full history snapshot.
  if (windowLabel !== "main") {
    const stats = await fetchNetworkStats();
    return {
      currentUpload: stats.upload_bytes_per_sec,
      currentDownload: stats.download_bytes_per_sec,
      liveData: {
        uploadBytesPerSec: stats.upload_bytes_per_sec,
        downloadBytesPerSec: stats.download_bytes_per_sec,
        interfaceName: stats.interface_name,
      },
    };
  } else {
    const snap = await fetchDashboardSnapshot();
    return {
      currentUpload: snap.current_upload,
      currentDownload: snap.current_download,
      snapshot: {
        peakUpload: snap.peak_upload,
        peakDownload: snap.peak_download,
        interfaceName: snap.interface_name,
        isConnected: snap.is_connected,
        history: snap.history,
      },
    };
  }
}
