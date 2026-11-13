import { getStorageItem } from "./storage";

export type ColorMode = "light" | "dark" | "system";

export const LS_MODE = "fluxnet_color_mode" as const;
export const LS_PILL_MODE = "fluxnet_pill_mode" as const;
export const LS_COMPACT_MODE = "fluxnet_compact_mode" as const;
export const LS_HUD_MODE = "fluxnet_hud_mode" as const;

export function isColorMode(value: unknown): value is ColorMode {
  return value === "light" || value === "dark" || value === "system";
}

export function getSystemTheme(): "light" | "dark" {
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
