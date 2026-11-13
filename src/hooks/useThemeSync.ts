import { useEffect } from "react";
import { fetchAppearance, setWindowTheme } from "@/api";
import {
  applyAppearance,
  applyColorMode,
  getStoredColorMode,
  LS_MODE,
  type ColorMode,
} from "@/utils";

/** Applies the stored colour mode to the page and the native window frame. */
export function applyThemeMode(mode: ColorMode = safeStoredMode()) {
  applyColorMode(mode);
  void setWindowTheme(mode === "system" ? null : mode);
}

function safeStoredMode(): ColorMode {
  try {
    return getStoredColorMode();
  } catch {
    return "system";
  }
}

/** Re-reads the Windows accent colour and backdrop support. */
export async function refreshAppearance() {
  applyAppearance(await fetchAppearance());
}

/**
 * Keeps the dashboard in step with the user's theme choice, the system
 * light/dark setting and the Windows accent colour.
 */
export function useThemeSync() {
  useEffect(() => {
    applyThemeMode();
    void refreshAppearance();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_MODE) applyThemeMode();
    };
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (safeStoredMode() === "system") applyColorMode("system");
    };
    // The accent may have changed in Windows Settings while we were away.
    const handleFocus = () => void refreshAppearance();

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    mediaQuery.addEventListener("change", handleSystemChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, []);
}
