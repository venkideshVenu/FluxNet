import { getStorageItem } from "./storage";

export type ColorMode = "light" | "dark" | "system";

export const LS_MODE = "fluxnet_color_mode" as const;
export const LS_PILL_MODE = "fluxnet_pill_mode" as const;
export const LS_COMPACT_MODE = "fluxnet_compact_mode" as const;
export const LS_HUD_MODE = "fluxnet_hud_mode" as const;

export function isColorMode(value: unknown): value is ColorMode {
  return value === "light" || value === "dark" || value === "system";
}

declare global {
  interface Window {
    /** Windows' app theme, set by the backend before the page loads. */
    __FLUXNET_SYSTEM_THEME?: unknown;
  }
}

/** Event the backend sends when Windows switches apps to light or dark. */
export const SYSTEM_THEME_EVENT = "system-theme-changed";

function reportedSystemTheme(): "light" | "dark" | null {
  if (typeof window === "undefined") return null;
  const theme = window.__FLUXNET_SYSTEM_THEME;
  return theme === "light" || theme === "dark" ? theme : null;
}

/**
 * The theme Windows uses for apps. On Windows this comes from the backend,
 * not `prefers-color-scheme`: WebView2 shares one colour-scheme preference
 * between all of FluxNet's windows, so setting the dashboard to light or dark
 * would otherwise change what "System" means for the widgets too.
 */
export function getSystemTheme(): "light" | "dark" {
  const reported = reportedSystemTheme();
  if (reported) return reported;
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function resolveColorMode(mode: ColorMode): "light" | "dark" {
  return mode === "system" ? getSystemTheme() : mode;
}

export function applyColorMode(mode: ColorMode) {
  document.documentElement.setAttribute("data-theme", resolveColorMode(mode));
}

function storedMode(key: string, fallback: ColorMode): ColorMode {
  const saved = getStorageItem(key as typeof LS_MODE, fallback);
  return isColorMode(saved) ? saved : fallback;
}

export function getStoredColorMode(): ColorMode {
  return storedMode(LS_MODE, "system");
}

export function getStoredPillMode(): ColorMode {
  return storedMode(LS_PILL_MODE, "dark");
}

export function getStoredCompactMode(): ColorMode {
  return storedMode(LS_COMPACT_MODE, "dark");
}

export function getStoredHudMode(): ColorMode {
  return storedMode(LS_HUD_MODE, "dark");
}

/**
 * Calls `onChange` whenever the system theme changes. Uses the backend's
 * event where it reports the theme (Windows), and the media query elsewhere
 * (other platforms, `pnpm dev:web`, tests).
 */
export function subscribeSystemTheme(
  onChange: () => void,
  listenToBackend: (
    event: string,
    handler: (payload: unknown) => void,
  ) => Promise<() => void>,
): () => void {
  if (reportedSystemTheme()) {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void listenToBackend(SYSTEM_THEME_EVENT, (payload) => {
      if (payload !== "light" && payload !== "dark") return;
      window.__FLUXNET_SYSTEM_THEME = payload;
      onChange();
    })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unlisten?.();
    };
  }
  const query = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!query) return () => {};
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
