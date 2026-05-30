export const LS_PILL_INTERVAL = "fluxnet_pill_interval_ms";
export const LS_COMPACT_INTERVAL = "fluxnet_compact_interval_ms";

export function getStoredPillIntervalMs(fallback = 1000): number {
  const saved = localStorage.getItem(LS_PILL_INTERVAL);
  const parsed = saved ? Number(saved) : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getStoredCompactIntervalMs(fallback = 1000): number {
  const saved = localStorage.getItem(LS_COMPACT_INTERVAL);
  const parsed = saved ? Number(saved) : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
}
