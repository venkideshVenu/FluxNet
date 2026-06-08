import { getStorageItem } from "./storage";

export const LS_PILL_ALWAYS_ON_TOP = "fluxnet_pill_always_on_top" as const;
export const LS_COMPACT_ALWAYS_ON_TOP =
  "fluxnet_compact_always_on_top" as const;
export const LS_HUD_ALWAYS_ON_TOP = "fluxnet_hud_always_on_top" as const;

export function getStoredPillAlwaysOnTop(fallback = false): boolean {
  const saved = getStorageItem(LS_PILL_ALWAYS_ON_TOP, String(fallback));
  if (saved === "true") return true;
  if (saved === "false") return false;
  return fallback;
}

export function getStoredCompactAlwaysOnTop(fallback = false): boolean {
  const saved = getStorageItem(LS_COMPACT_ALWAYS_ON_TOP, String(fallback));
  if (saved === "true") return true;
  if (saved === "false") return false;
  return fallback;
}

export function getStoredHudAlwaysOnTop(fallback = true): boolean {
  const saved = getStorageItem(LS_HUD_ALWAYS_ON_TOP, String(fallback));
  if (saved === "true") return true;
  if (saved === "false") return false;
  return fallback;
}
