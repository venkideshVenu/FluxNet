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

// FIX: Issue 15.1 — Properly typed preview configuration per widget type.
// Each widget has a specific preview component type and matching props getter.
// This eliminates `React.ComponentType<any>` and `Record<string, any>`.

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
      <div className="settings-row">
        <div>
          <div className="settings-label">Always on top</div>
          <div className="settings-sub">Float above all windows</div>
        </div>
        <Toggle
          checked={alwaysOnTop}
          onChange={() => onAlwaysOnTopChange(!alwaysOnTop)}
          label="Always on top"
        />
      </div>
      <div className="settings-row">
        <div>
          <div className="settings-label">Dark mode</div>
          <div className="settings-sub">Use a dark theme</div>
        </div>
        <Toggle
          checked={colorMode === "dark"}
          onChange={() =>
            onColorModeChange(colorMode === "dark" ? "light" : "dark")
          }
          label="Dark mode"
        />
      </div>
      <div className="settings-row">
        <div>
          <div className="settings-label">Refresh interval</div>
          <div className="settings-sub">How often the widget updates</div>
        </div>
        <select
          className="fn-select"
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
    <div className="settings-row">
      <div>
        <div className="settings-label">Opacity</div>
        <div className="settings-sub">{opacity}%</div>
      </div>
      <input
        type="range"
        className="fn-slider"
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

/**
 * FIX: Issue 15.1 — Type-safe preview rendering.
 * The Preview component and its props are linked through the WidgetViewConfig type.
 */
function WidgetPreview({ view, colorMode, opacity, intervalMs }: {
  view: WidgetViewConfig;
  colorMode: ColorMode;
  opacity: number;
  intervalMs: number;
}) {
  const Preview = view.previewComponent;
  const previewProps = view.getPreviewProps(colorMode, opacity, intervalMs);

  return (
    <div
      className="widget-preview-panel"
      style={{ background: view.entry.previewBg }}
    >
      <div className="preview-content">
        {/* @ts-expect-error — Preview and previewProps are correctly matched via WidgetViewConfig but TS can't narrow the union */}
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
    <div className="widget-section">
      <div
        className="settings-section-title"
        style={{ color: config.accentColor }}
      >
        {config.displayName}
      </div>
      <div className="widget-section-body">
        <div className="widget-settings-panel">
          <div
            className="settings-card"
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
          className={`visibility-btn ${state.visible ? "visible" : "hidden"}`}
          onClick={state.toggleVisible}
          disabled={state.visible === null}
          style={{ color: config.accentColor }}
        >
          <span
            className="visibility-btn-dot"
            style={{ background: config.accentColor }}
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
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Widget Settings</div>
          <div className="page-subtitle">
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