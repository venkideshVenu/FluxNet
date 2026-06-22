import {
  getStoredPillIntervalMs,
  getStoredCompactIntervalMs,
  getStoredHudIntervalMs,
  LS_PILL_INTERVAL,
  LS_COMPACT_INTERVAL,
  LS_HUD_INTERVAL,
  getStoredPillAlwaysOnTop,
  getStoredCompactAlwaysOnTop,
  getStoredHudAlwaysOnTop,
  LS_PILL_ALWAYS_ON_TOP,
  LS_COMPACT_ALWAYS_ON_TOP,
  LS_HUD_ALWAYS_ON_TOP,
  getStoredPillMode,
  getStoredCompactMode,
  getStoredHudMode,
  LS_PILL_MODE,
  LS_COMPACT_MODE,
  LS_HUD_MODE,
  ColorMode,
} from "@/utils";

export type WidgetLabel = "pill" | "compact" | "hud";

export type IntervalGetter = (fallback?: number) => number;
export type AlwaysOnTopGetter = (fallback?: boolean) => boolean;
export type ColorModeGetter = () => ColorMode;

export interface WidgetRegistryEntry {
  label: WidgetLabel;
  displayName: string;
  accentColor: string;
  previewBg: string;
  opacityKey: string;
  intervalKey: string;
  modeKey: string;
  alwaysOnTopKey: string;
  getStoredInterval: IntervalGetter;
  getStoredAlwaysOnTop: AlwaysOnTopGetter;
  getStoredMode: ColorModeGetter;
  invokeAlwaysOnTop: string;
  invokeOpacity: string;
  invokeVisibility: string;
  defaultOpacity: number;
  defaultAlwaysOnTop: boolean; // <-- added
}

export const WIDGET_REGISTRY: Record<WidgetLabel, WidgetRegistryEntry> = {
  pill: {
    label: "pill",
    displayName: "Pill Widget",
    accentColor: "#f59e0b",
    previewBg: "linear-gradient(135deg, #0f0d1a 0%, #1a1530 100%)",
    opacityKey: "fluxnet_opacity",
    intervalKey: LS_PILL_INTERVAL,
    modeKey: LS_PILL_MODE,
    alwaysOnTopKey: LS_PILL_ALWAYS_ON_TOP,
    getStoredInterval: getStoredPillIntervalMs,
    getStoredAlwaysOnTop: getStoredPillAlwaysOnTop,
    getStoredMode: getStoredPillMode,
    invokeAlwaysOnTop: "set_pill_always_on_top",
    invokeOpacity: "set_pill_opacity",
    invokeVisibility: "set_widget_visibility",
    defaultOpacity: 100, // changed from 88
    defaultAlwaysOnTop: true, // added
  },
  compact: {
    label: "compact",
    displayName: "Compact Widget",
    accentColor: "#22c97a",
    previewBg: "linear-gradient(135deg, #0d1a14 0%, #111f18 100%)",
    opacityKey: "fluxnet_compact_opacity",
    intervalKey: LS_COMPACT_INTERVAL,
    modeKey: LS_COMPACT_MODE,
    alwaysOnTopKey: LS_COMPACT_ALWAYS_ON_TOP,
    getStoredInterval: getStoredCompactIntervalMs,
    getStoredAlwaysOnTop: getStoredCompactAlwaysOnTop,
    getStoredMode: getStoredCompactMode,
    invokeAlwaysOnTop: "set_compact_always_on_top",
    invokeOpacity: "set_compact_opacity",
    invokeVisibility: "set_widget_visibility",
    defaultOpacity: 100,
    defaultAlwaysOnTop: true,
  },
  hud: {
    label: "hud",
    displayName: "HUD Widget",
    accentColor: "#7c6ff7",
    previewBg: "linear-gradient(135deg, #0c0b18 0%, #16142a 100%)",
    opacityKey: "fluxnet_hud_opacity",
    intervalKey: LS_HUD_INTERVAL,
    modeKey: LS_HUD_MODE,
    alwaysOnTopKey: LS_HUD_ALWAYS_ON_TOP,
    getStoredInterval: getStoredHudIntervalMs,
    getStoredAlwaysOnTop: getStoredHudAlwaysOnTop,
    getStoredMode: getStoredHudMode,
    invokeAlwaysOnTop: "set_hud_always_on_top",
    invokeOpacity: "set_hud_opacity",
    invokeVisibility: "set_widget_visibility",
    defaultOpacity: 100,
    defaultAlwaysOnTop: true,
  },
};

export const WIDGET_LABELS: WidgetLabel[] = ["pill", "compact", "hud"];
