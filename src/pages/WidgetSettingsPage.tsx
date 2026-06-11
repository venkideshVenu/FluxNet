import { ColorMode } from "@/utils";
import { Toggle } from "@/components";
import { PillPresentation } from "@/components";
import { CompactPresentation } from "@/components";
import { HudPresentation } from "@/components";
import type { PillPresentationProps } from "@/components/PillPresentation";
import type { CompactPresentationProps } from "@/components/CompactPresentation";
import type { HudPresentationProps } from "@/components/HudPresentation";
import {
  WIDGET_REGISTRY,
  WIDGET_LABELS,
  WidgetLabel,
  WidgetRegistryEntry,
} from "@/config";
import { useWidgetPanelState } from "@/hooks/useWidgetPanelState";
import { resolveColorMode } from "@/utils/theme";

interface PillViewConfig {
  entry: WidgetRegistryEntry;
  previewComponent: typeof PillPresentation;
  getPreviewProps: (
    colorMode: ColorMode,
    opacity: number,
    intervalMs: number,
  ) => PillPresentationProps;
}
interface CompactViewConfig {
  entry: WidgetRegistryEntry;
  previewComponent: typeof CompactPresentation;
  getPreviewProps: (
    colorMode: ColorMode,
    opacity: number,
    intervalMs: number,
  ) => CompactPresentationProps;
}
interface HudViewConfig {
  entry: WidgetRegistryEntry;
  previewComponent: typeof HudPresentation;
  getPreviewProps: (
    colorMode: ColorMode,
    opacity: number,
    intervalMs: number,
  ) => HudPresentationProps;
}
type WidgetViewConfig = PillViewConfig | CompactViewConfig | HudViewConfig;

const WIDGET_VIEWS: Record<WidgetLabel, WidgetViewConfig> = {
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
      interfaceName: "en0",
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

const INTERVAL_OPTIONS = [
  { value: "0.5", label: "0.5 seconds" },
  { value: "1", label: "1 second" },
  { value: "2", label: "2 seconds" },
  { value: "5", label: "5 seconds" },
];

function WidgetBehaviorSettings({
  alwaysOnTop,
  colorMode,
  intervalMs,
  onAlwaysOnTopChange,
  onColorModeChange,
  onIntervalChange,
}: {
  alwaysOnTop: boolean;
  colorMode: ColorMode;
  intervalMs: number;
  onAlwaysOnTopChange: (value: boolean) => void;
  onColorModeChange: (mode: ColorMode) => void;
  onIntervalChange: (raw: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-[18px] py-[13px] border-b border-accent-soft-2">
        <div>
          <div className="text-[13px] text-text font-[450]">Always on top</div>
          <div className="text-[11px] text-text-muted mt-0.5">
            Float above all windows
          </div>
        </div>
        <Toggle
          checked={alwaysOnTop}
          onChange={() => onAlwaysOnTopChange(!alwaysOnTop)}
          label="Always on top"
        />
      </div>
      <div className="flex items-center justify-between px-[18px] py-[13px] border-b border-accent-soft-2">
        <div>
          <div className="text-[13px] text-text font-[450]">Theme mode</div>
          <div className="text-[11px] text-text-muted mt-0.5">
            {colorMode === "system"
              ? "Follows Windows setting"
              : colorMode === "dark"
                ? "Always dark"
                : "Always light"}
          </div>
        </div>
        <select
          className="text-[12px] font-sans text-accent-strong bg-accent-soft border border-accent-border rounded-[7px] px-2.5 py-[5px] cursor-pointer outline-none"
          value={colorMode}
          onChange={(e) => onColorModeChange(e.target.value as ColorMode)}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div className="flex items-center justify-between px-[18px] py-[13px] border-b border-accent-soft-2">
        <div>
          <div className="text-[13px] text-text font-[450]">
            Refresh interval
          </div>
          <div className="text-[11px] text-text-muted mt-0.5">
            How often the widget updates
          </div>
        </div>
        <select
          className="text-[12px] font-sans text-accent-strong bg-accent-soft border border-accent-border rounded-[7px] px-2.5 py-[5px] cursor-pointer outline-none"
          value={String(intervalMs / 1000)}
          onChange={(e) => onIntervalChange(e.target.value)}
        >
          {INTERVAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function WidgetAppearanceSettings({
  opacity,
  onOpacityChange,
  onOpacityCommit,
}: {
  opacity: number;
  onOpacityChange: (value: number) => void;
  onOpacityCommit: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-[18px] py-[13px]">
      <div>
        <div className="text-[13px] text-text font-[450]">Opacity</div>
        <div className="text-[11px] text-text-muted mt-0.5">{opacity}%</div>
      </div>
      <input
        type="range"
        className="w-[120px] h-1 rounded-sm bg-accent-soft outline-none cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-accent"
        min={40}
        max={100}
        value={opacity}
        onChange={(e) => onOpacityChange(Number(e.target.value))}
        onMouseUp={(e) =>
          onOpacityCommit(Number((e.target as HTMLInputElement).value))
        }
        onTouchEnd={(e) =>
          onOpacityCommit(Number((e.target as HTMLInputElement).value))
        }
      />
    </div>
  );
}

function WidgetPreview({
  view,
  colorMode,
  opacity,
  intervalMs,
}: {
  view: WidgetViewConfig;
  colorMode: ColorMode;
  opacity: number;
  intervalMs: number;
}) {
  const Preview = view.previewComponent;
  const previewProps = view.getPreviewProps(colorMode, opacity, intervalMs);

  // Resolve "system" to actual theme for preview display
  const effectiveTheme = resolveColorMode(colorMode);
  const bgStyle =
    effectiveTheme === "light"
      ? { background: "rgba(255, 255, 255, 0.96)" }
      : { background: view.entry.previewBg };

  return (
    <div
      className="flex flex-col col-start-2 row-start-1"
      style={bgStyle}
      data-theme={effectiveTheme}
    >
      <div
        className="flex-1 flex items-center justify-center min-h-[220px]"
        style={{ opacity: opacity / 100 }}
      >
        {/* @ts-expect-error — Preview and previewProps are correctly matched */}
        <Preview {...previewProps} />
      </div>
    </div>
  );
}

function WidgetConfigPanel({ widgetLabel }: { widgetLabel: WidgetLabel }) {
  const view = WIDGET_VIEWS[widgetLabel];
  const config = view.entry;
  const state = useWidgetPanelState(config);

  return (
    <div className="mb-10 last:mb-0">
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-3"
        style={{ color: config.accentColor }}
      >
        {config.displayName}
      </div>
      <div className="grid grid-cols-[1fr_280px] grid-rows-[auto_auto] gap-0 rounded-[14px] border border-border overflow-hidden bg-panel max-[760px]:grid-cols-1">
        <div className="flex flex-col gap-2.5 p-5 border-r border-border col-start-1 row-start-1 max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:border-border">
          <div
            className="bg-panel border border-border rounded-lg overflow-hidden"
            style={{ borderTop: `2px solid ${config.accentColor}22` }}
          >
            <WidgetBehaviorSettings
              alwaysOnTop={state.alwaysOnTop}
              colorMode={state.colorMode}
              intervalMs={state.intervalMs}
              onAlwaysOnTopChange={state.handleAlwaysOnTop}
              onColorModeChange={state.handleColorMode}
              onIntervalChange={state.handleInterval}
            />
            <WidgetAppearanceSettings
              opacity={state.opacity}
              onOpacityChange={state.handleOpacityChange}
              onOpacityCommit={state.handleOpacityCommit}
            />
          </div>
        </div>

        <WidgetPreview
          view={view}
          colorMode={state.colorMode}
          opacity={state.opacity}
          intervalMs={state.intervalMs}
        />

        <button
          className="px-4 py-3 border-none bg-transparent text-[12px] font-semibold cursor-pointer font-sans tracking-[0.01em] uppercase border-t border-border col-span-full row-start-2 text-text transition-colors hover:bg-accent-soft-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={state.toggleVisible}
          disabled={state.visible === null}
          style={{ color: config.accentColor }}
        >
          <span
            className="w-[7px] h-[7px] rounded-full inline-block mr-1"
            style={{
              background: config.accentColor,
              boxShadow: state.visible ? "0 0 5px currentColor" : "none",
            }}
          />
          {state.visible === null
            ? "Loading…"
            : state.visible
              ? "Hide Widget"
              : "Show Widget"}
        </button>
      </div>
    </div>
  );
}

export function WidgetSettingsPage() {
  return (
    <div className="p-7 px-8 w-full max-w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[22px] font-semibold text-text tracking-[-0.02em] leading-none mb-[5px]">
            Widget Settings
          </div>
          <div className="text-[12px] text-text-muted font-normal">
            Configure Pill, Compact, and HUD widget behavior — preview updates
            live
          </div>
        </div>
      </div>
      {WIDGET_LABELS.map((label) => (
        <WidgetConfigPanel key={label} widgetLabel={label} />
      ))}
    </div>
  );
}
