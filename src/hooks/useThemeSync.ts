import { useEffect } from "react";
import {
  THEMES,
  applyAccent,
  applyColorMode,
  getStoredAccentIndex,
  getStoredColorMode,
  LS_THEME,
  LS_MODE,
} from "@/utils";

// Apply theme immediately (not in useEffect) to prevent flash
const initialMode = getStoredColorMode();
const initialAccentIndex = getStoredAccentIndex();
const initialSwatch = THEMES[initialAccentIndex] ?? THEMES[0];
applyAccent(initialSwatch.color);
applyColorMode(initialMode);

export function useThemeSync() {
  useEffect(() => {
    const apply = () => {
      const index = getStoredAccentIndex();
      const swatch = THEMES[index] ?? THEMES[0];
      applyAccent(swatch.color);
      applyColorMode(getStoredColorMode());
    };

    // Re-apply in case something changed between module load and mount
    apply();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_THEME || e.key === LS_MODE) {
        apply();
      }
    };

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      const mode = getStoredColorMode();
      if (mode === "system") {
        applyColorMode("system");
      }
    };

    window.addEventListener("storage", handleStorage);
    mediaQuery.addEventListener("change", handleSystemChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, []);
}
