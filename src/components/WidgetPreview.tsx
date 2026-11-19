import { ColorMode, resolveColorMode } from "@/utils";
import { PillPresentation } from "./PillPresentation";
import { CompactPresentation } from "./CompactPresentation";
import { HudPresentation } from "./HudPresentation";
import type { PillPresentationProps } from "./PillPresentation";
import type { CompactPresentationProps } from "./CompactPresentation";
import type { HudPresentationProps, HudDesign } from "./HudPresentation";
import { WIDGET_REGISTRY, WidgetLabel, WidgetRegistryEntry } from "@/config";

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
  PillViewConfig | CompactViewConfig | HudViewConfig;

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
      hasInterface: true,
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

export interface WidgetPreviewProps {
  view: WidgetViewConfig;
  colorMode: ColorMode;
  opacity?: number;
  intervalMs?: number;
  frameClassName?: string;
  hudFrameClassName?: string;
  hudDesign?: HudDesign;
}

export function WidgetPreview({
  view,
  colorMode,
  opacity = 100,
  intervalMs = 1000,
  frameClassName = "flex items-center justify-center py-5 px-4",
  hudFrameClassName,
  hudDesign,
}: WidgetPreviewProps) {
  const Preview = view.previewComponent;
  const previewProps = view.getPreviewProps(colorMode, opacity, intervalMs);
  const effectiveTheme = resolveColorMode(colorMode);

  return (
    <div
      className={frameClassName}
      style={{ opacity: opacity / 100 }}
      data-theme={effectiveTheme}
    >
      {/* Widgets size themselves, exactly as in their windows. */}
      {view.entry.label === "hud" ? (
        <div className={hudFrameClassName}>
          {/* @ts-expect-error — Preview and previewProps are correctly matched */}
          <Preview {...previewProps} design={hudDesign ?? "horizontal"} />
        </div>
      ) : (
        // @ts-expect-error — Preview and previewProps are correctly matched
        <Preview {...previewProps} />
      )}
    </div>
  );
}
