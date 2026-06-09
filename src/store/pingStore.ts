import { create } from "zustand";

/**
 * Ping/latency statistics store.
 * Used exclusively by the HUD widget via usePingPoller.
 */
type PingStats = {
  /** Ping latency in milliseconds. `null` means no data / timeout. */
  latencyMs: number | null;
  lossPercent: number;
};

type PingStore = {
  stats: PingStats;
  setStats: (s: PingStats) => void;
};

export const usePingStore = create<PingStore>((set) => ({
  stats: { latencyMs: null, lossPercent: 0 },
  setStats: (stats) => set({ stats }),
}));
