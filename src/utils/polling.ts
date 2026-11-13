import { getStorageItem } from "./storage";

export const MIN_POLL_INTERVAL_MS = 500;
export const MAX_POLL_INTERVAL_MS = 5000;

/**
 * Keeps a polling interval within what the 500ms backend sampler can serve.
 * A stored 0, negative or non-numeric value would otherwise spin the poller.
 */
export function clampPollInterval(ms: number, fallback = 1000): number {
  if (!Number.isFinite(ms)) return fallback;
  return Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, ms));
}

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
