import { getStorageItem } from "./storage";

export const LS_PILL_INTERVAL = "fluxnet_pill_interval_ms" as const;
export const LS_COMPACT_INTERVAL = "fluxnet_compact_interval_ms" as const;
export const LS_HUD_INTERVAL = "fluxnet_hud_interval_ms" as const;

export function getStoredPillIntervalMs(fallback = 1000): number {
  return getStorageItem(LS_PILL_INTERVAL, fallback);
}

export function getStoredCompactIntervalMs(fallback = 1000): number {
  return getStorageItem(LS_COMPACT_INTERVAL, fallback);
}

export function getStoredHudIntervalMs(fallback = 1000): number {
  return getStorageItem(LS_HUD_INTERVAL, fallback);
}
