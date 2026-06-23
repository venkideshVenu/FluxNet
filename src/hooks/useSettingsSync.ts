import { useEffect } from "react";
import { useSettingsStore, DisplayUnits } from "@/store";
import type {
  TimeFormat,
  DateFormat,
  StartOfWeek,
} from "@/store/settingsStore";

const SETTINGS_KEY = "fluxnet-settings";

export function useSettingsSync() {
  const setDisplayUnits = useSettingsStore((s) => s.setDisplayUnits);
  const setPollInterval = useSettingsStore((s) => s.setPollInterval);
  const setPingTarget = useSettingsStore((s) => s.setPingTarget);
  const setTimeFormat = useSettingsStore((s) => s.setTimeFormat);
  const setDateFormat = useSettingsStore((s) => s.setDateFormat);
  const setStartOfWeek = useSettingsStore((s) => s.setStartOfWeek);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== SETTINGS_KEY || !e.newValue) return;

      try {
        const parsed = JSON.parse(e.newValue);
        const state = parsed?.state;
        if (!state) return;

        const current = useSettingsStore.getState();

        if (state.displayUnits && state.displayUnits !== current.displayUnits) {
          setDisplayUnits(state.displayUnits as DisplayUnits);
        }
        if (
          state.pollIntervalMs != null &&
          state.pollIntervalMs !== current.pollIntervalMs
        ) {
          setPollInterval(state.pollIntervalMs);
        }
        if (state.pingTarget && state.pingTarget !== current.pingTarget) {
          setPingTarget(state.pingTarget);
        }
        if (state.timeFormat && state.timeFormat !== current.timeFormat) {
          setTimeFormat(state.timeFormat as TimeFormat);
        }
        if (state.dateFormat && state.dateFormat !== current.dateFormat) {
          setDateFormat(state.dateFormat as DateFormat);
        }
        if (state.startOfWeek && state.startOfWeek !== current.startOfWeek) {
          setStartOfWeek(state.startOfWeek as StartOfWeek);
        }
      } catch {
        // Ignore parse errors
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [
    setDisplayUnits,
    setPollInterval,
    setPingTarget,
    setTimeFormat,
    setDateFormat,
    setStartOfWeek,
  ]);
}
