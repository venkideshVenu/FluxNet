import { create } from "zustand";

type PingStats = {
  /** Ping latency in milliseconds. -1 indicates timeout/no response. */
  latencyMs: number;
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
