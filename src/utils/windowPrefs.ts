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


export const LS_HUD_DESIGN = "fluxnet_hud_design";

export function getStoredHudDesign(): HudDesign {
  const v = localStorage.getItem(LS_HUD_DESIGN);
  return v === "vertical" ? "vertical" : "horizontal";
}

export function setStoredHudDesign(design: HudDesign): void {
  localStorage.setItem(LS_HUD_DESIGN, design);
  window.dispatchEvent(new Event("fluxnet_hud_design_changed"));
}
