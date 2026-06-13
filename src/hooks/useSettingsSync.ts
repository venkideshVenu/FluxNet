import { useEffect } from "react";
import { useSettingsStore, DisplayUnits } from "@/store";

const SETTINGS_KEY = "fluxnet-settings";

/**
 * Listens for cross-window localStorage changes to the zustand settings store
 * and rehydrates the local store when another window updates it.
 *
 * Why this is needed:
 * - Each Tauri WebView window has its own JS runtime with its own zustand instance.
 * - zustand's `persist` middleware only rehydrates on mount, not on StorageEvent.
 * - When the dashboard changes displayUnits, widgets need to react immediately.
 */
export function useSettingsSync() {
  const setDisplayUnits = useSettingsStore((s) => s.setDisplayUnits);
  const setPollInterval = useSettingsStore((s) => s.setPollInterval);
  const setPingTarget = useSettingsStore((s) => s.setPingTarget);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== SETTINGS_KEY || !e.newValue) return;

      try {
        const parsed = JSON.parse(e.newValue);
        // zustand persist wraps state in { state: {...}, version: N }
        const state = parsed?.state;
        if (!state) return;

        if (state.displayUnits) {
          setDisplayUnits(state.displayUnits as DisplayUnits);
        }
        if (state.pollIntervalMs != null) {
          setPollInterval(state.pollIntervalMs);
        }
        if (state.pingTarget) {
          setPingTarget(state.pingTarget);
        }
      } catch {
        // Ignore parse errors
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [setDisplayUnits, setPollInterval, setPingTarget]);
}
