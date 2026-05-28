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

type NetworkStore = {
  data: NetworkData;
  isConnected: boolean;
  peakUpload: number;
  peakDownload: number;
  history: HistoryPoint[];
  setData: (data: NetworkData) => void;
  setConnected: (v: boolean) => void;
  setSnapshot: (snap: {
    currentUpload: number;
    currentDownload: number;
    peakUpload: number;
    peakDownload: number;
    interfaceName: string;
    history: HistoryPoint[];
  }) => void;
};

export const useNetworkStore = create<NetworkStore>((set) => ({
  data: { uploadBytesPerSec: 0, downloadBytesPerSec: 0, interfaceName: "" },
  isConnected: false,
  peakUpload: 0,
  peakDownload: 0,
  history: [],

  setData: (data) => set({ data, isConnected: true }),
  setConnected: (isConnected) => set({ isConnected }),

  setSnapshot: (snap) =>
    set({
      data: {
        uploadBytesPerSec: snap.currentUpload,
        downloadBytesPerSec: snap.currentDownload,
        interfaceName: snap.interfaceName,
      },
      isConnected: true,
      peakUpload: snap.peakUpload,
      peakDownload: snap.peakDownload,
      history: snap.history,
    }),
}));