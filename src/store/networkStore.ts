import { create } from "zustand";

export type NetworkData = {
  uploadBytesPerSec: number;
  downloadBytesPerSec: number;
  interfaceName: string;
};

type NetworkStore = {
  data: NetworkData;
  isConnected: boolean;
  setData: (data: NetworkData) => void;
  setConnected: (v: boolean) => void;
};

export const useNetworkStore = create<NetworkStore>((set) => ({
  data: {
    uploadBytesPerSec: 0,
    downloadBytesPerSec: 0,
    interfaceName: "",
  },
  isConnected: false,
  setData: (data) => set({ data, isConnected: true }),
  setConnected: (isConnected) => set({ isConnected }),
}));