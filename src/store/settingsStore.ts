import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Display unit system:
 * - "bytes": Adaptive B/s → KB/s → MB/s → GB/s (base 1024)
 * - "bits":  Adaptive bps → Kbps → Mbps → Gbps (base 1000, ×8)
 */
export type DisplayUnits = "bytes" | "bits";

type SettingsStore = {
  pollIntervalMs: number;
  displayUnits: DisplayUnits;
  pingTarget: string;
  setPollInterval: (ms: number) => void;
  setDisplayUnits: (u: DisplayUnits) => void;
  setPingTarget: (t: string) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      pollIntervalMs: 1000,
      displayUnits: "bytes",
      pingTarget: "8.8.8.8",
      setPollInterval: (ms) => set({ pollIntervalMs: ms }),
      setDisplayUnits: (u) => set({ displayUnits: u }),
      setPingTarget: (t) => set({ pingTarget: t }),
    }),
    {
      name: "fluxnet-settings",
    },
  ),
);

export function getDisplayUnits(): DisplayUnits {
  return useSettingsStore.getState().displayUnits;
}
