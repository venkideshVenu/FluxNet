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

    // Listen for OS theme changes (for "system" mode)
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
