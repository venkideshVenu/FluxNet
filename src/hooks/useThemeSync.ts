import { useEffect } from "react";
import {
  THEMES,
  applyAccent,
  applyColorMode,
  getStoredAccentIndex,
  getStoredColorMode,
  LS_THEME,
  LS_MODE,
} from "../utils/theme";

// FIX: Issue 5.4 — Theme initialization with storage event subscription
export function useThemeSync() {
  useEffect(() => {
    const apply = () => {
      const index = getStoredAccentIndex();
      const swatch = THEMES[index] ?? THEMES[0];
      applyAccent(swatch.color);
      applyColorMode(getStoredColorMode());
    };

    apply();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_THEME || e.key === LS_MODE) {
        apply();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);
}
