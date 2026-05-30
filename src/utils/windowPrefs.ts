export const LS_PILL_ALWAYS_ON_TOP = "fluxnet_pill_always_on_top";
export const LS_COMPACT_ALWAYS_ON_TOP = "fluxnet_compact_always_on_top";
export const LS_HUD_ALWAYS_ON_TOP = "fluxnet_hud_always_on_top";

function getStoredBoolean(key: string, fallback: boolean): boolean {
  const saved = localStorage.getItem(key);
  if (saved === "true") return true;
  if (saved === "false") return false;
  return fallback;
}

export function getStoredPillAlwaysOnTop(fallback = false): boolean {
  return getStoredBoolean(LS_PILL_ALWAYS_ON_TOP, fallback);
}

export function getStoredCompactAlwaysOnTop(fallback = false): boolean {
  return getStoredBoolean(LS_COMPACT_ALWAYS_ON_TOP, fallback);
}

export function getStoredHudAlwaysOnTop(fallback = true): boolean {
  return getStoredBoolean(LS_HUD_ALWAYS_ON_TOP, fallback);
}
