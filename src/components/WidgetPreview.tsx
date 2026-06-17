import { ColorMode, resolveColorMode } from "@/utils";
import { PillPresentation } from "./PillPresentation";
import { CompactPresentation } from "./CompactPresentation";
import { HudPresentation } from "./HudPresentation";
import type { PillPresentationProps } from "./PillPresentation";
import type { CompactPresentationProps } from "./CompactPresentation";
import type { HudPresentationProps } from "./HudPresentation";
import { WIDGET_REGISTRY, WidgetLabel, WidgetRegistryEntry } from "@/config";

// ── View config types ────────────────────────────────────────────────────────

export interface PillViewConfig {
  entry: WidgetRegistryEntry;
  previewComponent: typeof PillPresentation;
  getPreviewProps: (
    colorMode: ColorMode,
    opacity: number,
    intervalMs: number,
  ) => PillPresentationProps;
}
export interface CompactViewConfig {
  entry: WidgetRegistryEntry;
  previewComponent: typeof CompactPresentation;
  getPreviewProps: (
    colorMode: ColorMode,
    opacity: number,
    intervalMs: number,
  ) => CompactPresentationProps;
}
export interface HudViewConfig {
  entry: WidgetRegistryEntry;
  previewComponent: typeof HudPresentation;
  getPreviewProps: (
    colorMode: ColorMode,
    opacity: number,
    intervalMs: number,
  ) => HudPresentationProps;
}
export type WidgetViewConfig =
  | PillViewConfig
  | CompactViewConfig
  | HudViewConfig;

// ── Mock data + presentation wiring for each widget style ───────────────────
//
// This is the single source of truth for "what does widget X look like with
// representative sample data". Used by the WidgetSettingsPage preview strips
// and the Onboarding widget-style picker so both stay visually identical.

export const WIDGET_VIEWS: Record<WidgetLabel, WidgetViewConfig> = {
  pill: {
    entry: WIDGET_REGISTRY.pill,
    previewComponent: PillPresentation,
    getPreviewProps: () => ({
      downloadValue: "24.5",
      downloadUnit: "MB/s",
      uploadValue: "3.2",
      uploadUnit: "MB/s",
      isConnected: true,
    }),
  },
  compact: {
    entry: WIDGET_REGISTRY.compact,
    previewComponent: CompactPresentation,
    getPreviewProps: (_mode, _opacity, intervalMs) => ({
      interfaceName: "Wi-Fi",
      isConnected: true,
      intervalLabel: `${intervalMs / 1000}s`,
      download: { value: "24.5", unit: "MB/s" },
      upload: { value: "3.2", unit: "MB/s" },
      todayDownload: { value: "12.3", unit: "GB" },
      todayUpload: { value: "2.1", unit: "GB" },
    }),
  },
  hud: {
    entry: WIDGET_REGISTRY.hud,
    previewComponent: HudPresentation,
    getPreviewProps: () => ({
      downloadValue: "24.5",
      downloadUnit: "MB/s",
      uploadValue: "3.2",
      uploadUnit: "MB/s",
      latencyMs: 42,
      lossPercent: 0,
    }),
  },
};

/**
 * CSS custom-property overrides for the pill / HUD previews.
 *
 * The pill and HUD widgets pick up their colors from variables that are
 * normally re-declared on `:root[data-theme="..."]`. That selector only
 * matches the <html> element, so it never applies to a `data-theme`
 * attribute set on a preview container further down the tree — which is
 * why switching the per-widget theme mode previously had no visible effect
 * on the pill/HUD previews. Re-declaring the same variables inline on the
 * preview frame keeps the preview in sync with the selected theme mode
 * regardless of the app's global theme.
 */
export const PREVIEW_THEME_VARS: Record<"light" | "dark", React.CSSProperties> =
  {
    light: {
      "--net-upload": "#0a7a3e",
      "--net-download": "#0c6090",
      "--pill-bg": "#f0eff8",
      "--pill-border": "rgba(60, 50, 140, 0.25)",
      "--pill-sep": "rgba(60, 50, 140, 0.18)",
      "--pill-text": "#131020",
      "--hud-bg-outer": "#f0eff8",
      "--hud-bg-card": "#f5f4fb",
      "--hud-border": "rgba(60, 50, 140, 0.18)",
      "--hud-rule": "rgba(60, 50, 140, 0.12)",
      "--hud-brand": "#131020",
      "--hud-label": "#3d3760",
      "--hud-good": "#0f8c42",
      "--hud-amber": "#b86d00",
      "--hud-danger": "#c62828",
      "--hud-neutral": "#131020",
      "--hud-muted": "#5a5478",
      "--hud-up": "#0a7a3e",
      "--hud-dn": "#0c6090",
    } as React.CSSProperties,
    dark: {
      "--net-upload": "#34d399",
      "--net-download": "#38bdf8",
      "--pill-bg": "rgb(18, 16, 32)",
      "--pill-border": "rgba(124, 111, 247, 0.14)",
      "--pill-sep": "rgba(124, 111, 247, 0.12)",
      "--pill-text": "#e9e8f4",
      "--hud-bg-outer": "#0c0b18",
      "--hud-bg-card": "#13111f",
      "--hud-border": "rgba(90, 80, 180, 0.35)",
      "--hud-rule": "rgba(90, 80, 180, 0.18)",
      "--hud-brand": "rgba(235, 234, 255, 0.9)",
      "--hud-label": "rgba(214, 211, 255, 0.85)",
      "--hud-good": "#22c55e",
      "--hud-amber": "#f59e0b",
      "--hud-danger": "#ef4444",
      "--hud-neutral": "#ffffff",
      "--hud-muted": "rgba(234, 233, 255, 0.6)",
      "--hud-up": "#34d399",
      "--hud-dn": "#38bdf8",
    } as React.CSSProperties,
  };

// ── Shared preview renderer ──────────────────────────────────────────────────

export interface WidgetPreviewProps {
  view: WidgetViewConfig;
  colorMode: ColorMode;
  /** 40–100. Defaults to fully opaque. */
  opacity?: number;
  /** Refresh interval in ms — only affects the compact widget's interval label. */
  intervalMs?: number;
  /** Classes for the outer frame that carries the theme vars + data-theme. */
  frameClassName?: string;
  /** Classes for the sizing wrapper used only for the HUD preview (it needs an explicit aspect ratio). */
  hudFrameClassName?: string;
}

export function WidgetPreview({
  view,
  colorMode,
  opacity = 100,
  intervalMs = 1000,
  frameClassName = "flex items-center justify-center py-5 px-4",
  hudFrameClassName = "w-full max-w-52 aspect-[6/5]",
}: WidgetPreviewProps) {
  const Preview = view.previewComponent;
  const previewProps = view.getPreviewProps(colorMode, opacity, intervalMs);
  const effectiveTheme = resolveColorMode(colorMode);

  return (
    <div
      className={frameClassName}
      style={{ ...PREVIEW_THEME_VARS[effectiveTheme], opacity: opacity / 100 }}
      data-theme={effectiveTheme}
    >
      {view.entry.label === "hud" ? (
        <div className={hudFrameClassName}>
          {/* @ts-expect-error — Preview and previewProps are correctly matched */}
          <Preview {...previewProps} />
        </div>
      ) : (
        <div>
          {/* @ts-expect-error — Preview and previewProps are correctly matched */}
          <Preview {...previewProps} />
        </div>
      )}
    </div>
  );
}
