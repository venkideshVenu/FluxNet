import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  applyColorMode,
  getStoredPillMode,
  getStoredCompactMode,
  getStoredHudMode,
  LS_PILL_MODE,
  LS_COMPACT_MODE,
  LS_HUD_MODE,
} from "@/utils/theme";
import {
  getStoredPillAlwaysOnTop,
  getStoredCompactAlwaysOnTop,
  getStoredHudAlwaysOnTop,
  LS_PILL_ALWAYS_ON_TOP,
  LS_COMPACT_ALWAYS_ON_TOP,
  LS_HUD_ALWAYS_ON_TOP,
} from "@/utils/windowPrefs";

type WidgetLabel = "pill" | "compact" | "hud";

const opacityKey: Record<WidgetLabel, string> = {
  pill: "fluxnet_opacity",
  compact: "fluxnet_compact_opacity",
  hud: "fluxnet_hud_opacity",
};

const modeKey: Record<WidgetLabel, string> = {
  pill: LS_PILL_MODE,
  compact: LS_COMPACT_MODE,
  hud: LS_HUD_MODE,
};

const alwaysOnTopKey: Record<WidgetLabel, string> = {
  pill: LS_PILL_ALWAYS_ON_TOP,
  compact: LS_COMPACT_ALWAYS_ON_TOP,
  hud: LS_HUD_ALWAYS_ON_TOP,
};

const getStoredMode: Record<WidgetLabel, () => "light" | "dark"> = {
  pill: () => getStoredPillMode(),
  compact: () => getStoredCompactMode(),
  hud: () => getStoredHudMode(),
};

const getStoredAlwaysOnTop: Record<
  WidgetLabel,
  (fallback?: boolean) => boolean
> = {
  pill: (f) => getStoredPillAlwaysOnTop(f),
  compact: (f) => getStoredCompactAlwaysOnTop(f),
  hud: (f) => getStoredHudAlwaysOnTop(f),
};

function getStoredOpacity(key: string, fallback = 88): number {
  const saved = localStorage.getItem(key);
  const parsed = saved ? Number(saved) : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function useWidgetSettings(label: WidgetLabel) {
  useEffect(() => {
    // Apply initial color mode
    applyColorMode(getStoredMode[label]());

    // Apply initial always‑on‑top
    invoke("set_widget_always_on_top", {
      label,
      value: getStoredAlwaysOnTop[label](),
    }).catch(console.error);

    // Apply initial opacity
    const opacity = getStoredOpacity(opacityKey[label]) / 100;
    invoke("set_widget_opacity", { label, value: opacity }).catch(
      console.error,
    );

    // Listen for storage changes from other windows (e.g., WidgetSettingsPage)
    const handleStorage = (event: StorageEvent) => {
      if (event.key === alwaysOnTopKey[label] && event.newValue !== null) {
        invoke("set_widget_always_on_top", {
          label,
          value: event.newValue === "true",
        }).catch(console.error);
      } else if (event.key === opacityKey[label] && event.newValue !== null) {
        const next = Number(event.newValue) / 100;
        if (Number.isFinite(next)) {
          invoke("set_widget_opacity", { label, value: next }).catch(
            console.error,
          );
        }
      } else if (event.key === modeKey[label] && event.newValue !== null) {
        if (event.newValue === "light" || event.newValue === "dark") {
          applyColorMode(event.newValue);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [label]);
}
