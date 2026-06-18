import { create } from "zustand";

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ MULTI-WINDOW ISOLATION NOTICE                                            │
 * │                                                                          │
 * │ In Tauri's multi-window architecture, each window (pill, compact, hud,  │
 * │ main/dashboard) runs in its own WebView with a completely separate       │
 * │ JavaScript runtime. This means:                                          │
 * │                                                                          │
 * │ • Each window has its OWN instance of this store                         │
 * │ • Store state is NOT shared across windows                               │
 * │ • Changes in one window's store do NOT propagate to other windows        │
 * │                                                                          │
 * │ Cross-window communication happens via:                                  │
 * │ • localStorage (with StorageEvent for reactivity)                        │
 * │ • Tauri IPC (invoke commands that modify shared backend state)           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export type NetworkData = {
  uploadBytesPerSec: number;
  downloadBytesPerSec: number;
  interfaceName: string;
};

export type HistoryPoint = {
  upload: number;
  download: number;
  t: number;
};

type NetworkStore = {
  data: NetworkData;
  isConnected: boolean;
  isInitialized: boolean;
  lastError: string | null;
  peakUpload: number;
  peakDownload: number;
  history: HistoryPoint[];
  todayUploadBytes: number;
  todayDownloadBytes: number;

  setData: (data: NetworkData) => void;
  setConnected: (v: boolean) => void;
  setError: (err: string | null) => void;
  setSnapshot: (snap: {
    currentUpload: number;
    currentDownload: number;
    peakUpload: number;
    peakDownload: number;
    interfaceName: string;
    isConnected?: boolean;
    history: HistoryPoint[];
  }) => void;
  addTodayUsage: (uploadBytes: number, downloadBytes: number) => void;
  resetTodayUsage: () => void;
  resetPeaks: () => void;
  dismissError: () => void;
};

const MAX_HISTORY_POINTS = 600;

export const useNetworkStore = create<NetworkStore>((set) => ({
  data: { uploadBytesPerSec: 0, downloadBytesPerSec: 0, interfaceName: "" },
  isConnected: false,
  isInitialized: false,
  lastError: null,
  peakUpload: 0,
  peakDownload: 0,
  history: [],
  todayUploadBytes: 0,
  todayDownloadBytes: 0,

  setData: (data) =>
    set({ data, isConnected: true, isInitialized: true, lastError: null }),
  setConnected: (isConnected) => set({ isConnected }),
  setError: (lastError) => set({ lastError, isConnected: false }),
  dismissError: () => set({ lastError: null }),

  setSnapshot: (snap) =>
    set({
      data: {
        uploadBytesPerSec: snap.currentUpload,
        downloadBytesPerSec: snap.currentDownload,
        interfaceName: snap.interfaceName,
      },
      isConnected: snap.isConnected ?? true,
      isInitialized: true,
      lastError: null,
      peakUpload: snap.peakUpload,
      peakDownload: snap.peakDownload,
      history: snap.history.slice(-MAX_HISTORY_POINTS),
    }),

  addTodayUsage: (uploadBytes, downloadBytes) =>
    set((state) => ({
      todayUploadBytes: state.todayUploadBytes + Math.max(0, uploadBytes),
      todayDownloadBytes: state.todayDownloadBytes + Math.max(0, downloadBytes),
    })),

  resetTodayUsage: () => set({ todayUploadBytes: 0, todayDownloadBytes: 0 }),
  resetPeaks: () => set({ peakUpload: 0, peakDownload: 0 }),
}));
