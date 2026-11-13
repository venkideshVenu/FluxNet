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

/**
 * Applies the stored accent and colour mode. Storage can be unavailable
 * (blocked, or in some test environments), so failures fall back to the
 * defaults instead of throwing.
 */
function applyStoredTheme() {
  try {
    const swatch = THEMES[getStoredAccentIndex()] ?? THEMES[0];
    applyAccent(swatch.color);
    applyColorMode(getStoredColorMode());
  } catch (err) {
    console.warn("FluxNet: could not apply stored theme", err);
  }
}

// Apply once at load (not in useEffect) to prevent a flash of the wrong theme
applyStoredTheme();

export function useThemeSync() {
  useEffect(() => {
    const apply = applyStoredTheme;

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
