import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DisplayUnits = "bytes" | "bits";
export type TimeFormat = "12h" | "24h";
export type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
export type StartOfWeek = "sunday" | "monday" | "saturday";

type SettingsStore = {
  pollIntervalMs: number;
  displayUnits: DisplayUnits;
  pingTarget: string;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  startOfWeek: StartOfWeek;
  setPollInterval: (ms: number) => void;
  setDisplayUnits: (u: DisplayUnits) => void;
  setPingTarget: (t: string) => void;
  setTimeFormat: (f: TimeFormat) => void;
  setDateFormat: (f: DateFormat) => void;
  setStartOfWeek: (d: StartOfWeek) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      pollIntervalMs: 1000,
      displayUnits: "bytes",
      pingTarget: "1.1.1.1",
      timeFormat: "12h",
      dateFormat: "MM/DD/YYYY",
      startOfWeek: "sunday",
      setPollInterval: (ms) => set({ pollIntervalMs: ms }),
      setDisplayUnits: (u) => set({ displayUnits: u }),
      setPingTarget: (t) => set({ pingTarget: t }),
      setTimeFormat: (f) => set({ timeFormat: f }),
      setDateFormat: (f) => set({ dateFormat: f }),
      setStartOfWeek: (d) => set({ startOfWeek: d }),
    }),
    {
      name: "fluxnet-settings",
    },
  ),
);

export function getDisplayUnits(): DisplayUnits {
  return useSettingsStore.getState().displayUnits;
}
