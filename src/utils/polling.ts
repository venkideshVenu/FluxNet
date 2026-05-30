export const LS_PILL_INTERVAL = "fluxnet_pill_interval_ms";

export function getStoredPillIntervalMs(fallback = 1000): number {
  const saved = localStorage.getItem(LS_PILL_INTERVAL);
  const parsed = saved ? Number(saved) : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
}
