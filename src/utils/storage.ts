export type StorageSchema = {
  fluxnet_opacity: number;
  fluxnet_compact_opacity: number;
  fluxnet_hud_opacity: number;
  fluxnet_pill_interval_ms: number;
  fluxnet_compact_interval_ms: number;
  fluxnet_hud_interval_ms: number;
  fluxnet_accent_index: number;
  fluxnet_color_mode: string;
  fluxnet_pill_mode: string;
  fluxnet_compact_mode: string;
  fluxnet_hud_mode: string;
  fluxnet_pill_always_on_top: string;
  fluxnet_compact_always_on_top: string;
  fluxnet_hud_always_on_top: string;
  fluxnet_display_units: string;
  fluxnet_configured: string;
  fluxnet_ping_target: string;
};

export function getStorageItem<K extends keyof StorageSchema>(
  key: K,
  fallback: StorageSchema[K],
): StorageSchema[K] {
  const saved = localStorage.getItem(key);
  if (saved === null) return fallback;
  if (typeof fallback === "number") {
    const parsed = Number(saved);
    return (Number.isFinite(parsed) ? parsed : fallback) as StorageSchema[K];
  }
  return saved as StorageSchema[K];
}

export function setStorageItem<K extends keyof StorageSchema>(
  key: K,
  value: StorageSchema[K],
): void {
  localStorage.setItem(key, String(value));
}
