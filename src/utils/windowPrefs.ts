import { getStorageItem } from "./storage";
import type { HudDesign } from "@/components/HudPresentation";

export const LS_PILL_ALWAYS_ON_TOP = "fluxnet_pill_always_on_top" as const;
export const LS_COMPACT_ALWAYS_ON_TOP =
  "fluxnet_compact_always_on_top" as const;
export const LS_HUD_ALWAYS_ON_TOP = "fluxnet_hud_always_on_top" as const;

export function getStoredPillAlwaysOnTop(fallback = true): boolean {
  const saved = getStorageItem(LS_PILL_ALWAYS_ON_TOP, String(fallback));
  if (saved === "true") return true;
  if (saved === "false") return false;
  return fallback;
}

export function getStoredCompactAlwaysOnTop(fallback = true): boolean {
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

// ── HUD Design ────────────────────────────────────────────────────────────────
//
// The backend (`get_hud_design` / `set_hud_design`) is the source of truth.
// localStorage only caches the last known value so a freshly created HUD
// window renders the right layout on its first frame instead of flashing
// the default while the backend call is in flight.

export const LS_HUD_DESIGN = "fluxnet_hud_design";

/** Returns a valid design or null for anything else. */
export function parseHudDesign(value: unknown): HudDesign | null {
  return value === "horizontal" || value === "vertical" ? value : null;
}

export function getCachedHudDesign(): HudDesign {
  try {
    return parseHudDesign(localStorage.getItem(LS_HUD_DESIGN)) ?? "horizontal";
  } catch {
    return "horizontal";
  }
}

export function cacheHudDesign(design: HudDesign): void {
  try {
    localStorage.setItem(LS_HUD_DESIGN, design);
  } catch {
    // Cache only — the backend still has the value.
  }
}
