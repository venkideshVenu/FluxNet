import { create } from "zustand";

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

// Settings now live exclusively in settingsStore with persist middleware.

type NetworkStore = {
  data: NetworkData;
  isConnected: boolean;
  isInitialized: boolean;
  peakUpload: number;
  peakDownload: number;
  history: HistoryPoint[];
  todayUploadBytes: number;
  todayDownloadBytes: number;

  setData: (data: NetworkData) => void;
  setConnected: (v: boolean) => void;
  setSnapshot: (snap: {
    currentUpload: number;
    currentDownload: number;
    peakUpload: number;
    peakDownload: number;
    interfaceName: string;
    history: HistoryPoint[];
    isConnected?: boolean;
  }) => void;
  addTodayUsage: (uploadBytes: number, downloadBytes: number) => void;
  resetTodayUsage: () => void;
  resetPeaks: () => void;
};

const MAX_HISTORY_POINTS = 300;

export const useNetworkStore = create<NetworkStore>((set) => ({
  data: { uploadBytesPerSec: 0, downloadBytesPerSec: 0, interfaceName: "" },
  isConnected: false,
  isInitialized: false,
  peakUpload: 0,
  peakDownload: 0,
  history: [],
  todayUploadBytes: 0,
  todayDownloadBytes: 0,

  setData: (data) => set({ data, isConnected: true, isInitialized: true }),
  setConnected: (isConnected) => set({ isConnected }),

  setSnapshot: (snap) =>
    set({
      data: {
        uploadBytesPerSec: snap.currentUpload,
        downloadBytesPerSec: snap.currentDownload,
        interfaceName: snap.interfaceName,
      },
      isConnected: snap.isConnected ?? true,
      isInitialized: true,
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
