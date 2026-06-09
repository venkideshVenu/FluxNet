import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DisplayUnits = "auto" | "MB/s" | "KB/s" | "Mbps";

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
      displayUnits: "auto",
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
