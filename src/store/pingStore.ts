import { create } from "zustand";

type PingStats = {
  latencyMs: number; // -1 means timeout
  lossPercent: number;
};

type PingStore = {
  stats: PingStats;
  setStats: (s: PingStats) => void;
};

export const usePingStore = create<PingStore>((set) => ({
  stats: { latencyMs: -1, lossPercent: 0 },
  setStats: (stats) => set({ stats }),
}));
