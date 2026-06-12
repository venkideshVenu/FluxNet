import { useState } from "react";
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

const WIDGET_DESCRIPTIONS: Record<WidgetLabel, string> = {
  pill: "Minimal floating pill — shows download and upload speed at a glance",
  compact: "Detailed card widget — speeds, interface status, and daily totals",
  hud: "Gaming overlay — network speed, ping latency, and packet loss",
};

const INTERVAL_OPTIONS = [
  { value: "0.5", label: "500ms" },
  { value: "1", label: "1s" },
  { value: "2", label: "2s" },
  { value: "5", label: "5s" },
];

const COLOR_MODE_OPTIONS: { value: ColorMode; label: string; icon: string }[] =
  [
    { value: "system", label: "System", icon: "💻" },
    { value: "dark", label: "Dark", icon: "🌙" },
    { value: "light", label: "Light", icon: "☀️" },
  ];

// ── Sub-components ────────────────────────────────────────────────────────────

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
  const effectiveTheme = resolveColorMode(colorMode);

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-border"
      style={{
        background:
          effectiveTheme === "light"
            ? "linear-gradient(135deg, #f8f7ff 0%, #eeedf8 100%)"
            : view.entry.previewBg,
      }}
      data-theme={effectiveTheme}
    >
      {/* Decorative grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      />
      <div
        className="relative flex items-center justify-center py-6 sm:py-10 px-4 sm:px-6 min-h-40 sm:min-h-48"
        style={{ opacity: opacity / 100 }}
      >
        {view.entry.label === "hud" ? (
          <div className="w-full max-w-60 aspect-[6/5]">
            {/* @ts-expect-error — Preview and previewProps are correctly matched */}
            <Preview {...previewProps} />
          </div>
        ) : (
          // @ts-expect-error — Preview and previewProps are correctly matched
          <Preview {...previewProps} />
        )}
      </div>
    </div>
  );
}

function OpacitySlider({
  value,
  onChange,
  onCommit,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="range"
        className="flex-1 min-w-24 h-1.5 rounded-full bg-border appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_var(--accent-soft),0_2px_6px_rgba(0,0,0,0.15)] [&::-webkit-slider-thumb]:transition-shadow [&::-webkit-slider-thumb]:hover:shadow-[0_0_0_4px_var(--accent-soft),0_2px_8px_rgba(0,0,0,0.2)]"
        min={40}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={(e) =>
          onCommit(Number((e.target as HTMLInputElement).value))
        }
        onTouchEnd={(e) =>
          onCommit(Number((e.target as HTMLInputElement).value))
        }
      />
      <span className="text-[12px] font-mono text-text-muted w-9 text-right tabular-nums">
        {value}%
      </span>
    </div>
  );
}

function ColorModeSelector({
  value,
  onChange,
}: {
  value: ColorMode;
  onChange: (mode: ColorMode) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-all border whitespace-nowrap ${
            value === option.value
              ? "bg-accent text-white border-accent shadow-[0_2px_8px_rgba(124,111,247,0.3)]"
              : "bg-surface text-text-muted border-border hover:border-accent-border hover:text-text"
          }`}
        >
          <span className="text-[12px]">{option.icon}</span>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function IntervalSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (raw: string) => void;
}) {
  const currentValue = String(value / 1000);
  return (
    <div className="flex flex-wrap gap-1.5">
      {INTERVAL_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all border whitespace-nowrap ${
            currentValue === option.value
              ? "bg-accent text-white border-accent shadow-[0_2px_8px_rgba(124,111,247,0.3)]"
              : "bg-surface text-text-muted border-border hover:border-accent-border hover:text-text"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3.5 px-4">
      <div className="min-w-0 flex-1 basis-32">
        <div className="text-[13px] text-text font-medium">{label}</div>
        {description && (
          <div className="text-[11px] text-text-muted mt-0.5">
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0 max-w-full">{children}</div>
    </div>
  );
}

// ── Main Widget Panel ─────────────────────────────────────────────────────────

function WidgetConfigPanel({ widgetLabel }: { widgetLabel: WidgetLabel }) {
  const view = WIDGET_VIEWS[widgetLabel];
  const config = view.entry;
  const state = useWidgetPanelState(config);
  const [isExpanded, setIsExpanded] = useState(true);

  const statusDot = state.visible
    ? "bg-[#34d399] shadow-[0_0_6px_rgba(52,211,153,0.5)]"
    : "bg-text-muted opacity-50";

  return (
    <div className="mb-8 last:mb-0">
      {/* Widget Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[13px] font-bold shadow-md shrink-0"
            style={{
              background: `linear-gradient(135deg, ${config.accentColor}, ${config.accentColor}cc)`,
              boxShadow: `0 4px 12px ${config.accentColor}33`,
            }}
          >
            {config.displayName.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-semibold text-text">
                {config.displayName}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${statusDot} transition-all shrink-0`}
              />
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                {state.visible === null
                  ? "Loading"
                  : state.visible
                    ? "Visible"
                    : "Hidden"}
              </span>
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">
              {WIDGET_DESCRIPTIONS[widgetLabel]}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={state.toggleVisible}
            disabled={state.visible === null}
            className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${
              state.visible
                ? "bg-surface text-text-muted border-border hover:border-danger-border hover:text-danger-text hover:bg-danger-bg"
                : "text-white border-transparent hover:opacity-90"
            }`}
            style={
              !state.visible
                ? {
                    background: config.accentColor,
                    boxShadow: `0 2px 8px ${config.accentColor}44`,
                  }
                : undefined
            }
          >
            {state.visible === null ? "…" : state.visible ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-7 h-7 rounded-lg border border-border bg-surface text-text-muted flex items-center justify-center cursor-pointer hover:border-accent-border hover:text-text transition-all"
            aria-label={isExpanded ? "Collapse settings" : "Expand settings"}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="grid grid-cols-1 min-[820px]:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] gap-5">
          {/* Settings Column */}
          <div className="flex flex-col gap-4">
            {/* Behavior Section */}
            <div>
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 px-1">
                Behavior
              </div>
              <div className="bg-panel border border-border rounded-xl overflow-hidden divide-y divide-border">
                <SettingRow
                  label="Always on top"
                  description="Float above all other windows"
                >
                  <Toggle
                    checked={state.alwaysOnTop}
                    onChange={() => state.handleAlwaysOnTop(!state.alwaysOnTop)}
                    label="Always on top"
                  />
                </SettingRow>

                <SettingRow
                  label="Refresh interval"
                  description="How often data updates"
                >
                  <IntervalSelector
                    value={state.intervalMs}
                    onChange={state.handleInterval}
                  />
                </SettingRow>
              </div>
            </div>

            {/* Appearance Section */}
            <div>
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 px-1">
                Appearance
              </div>
              <div className="bg-panel border border-border rounded-xl overflow-hidden divide-y divide-border">
                <SettingRow
                  label="Theme mode"
                  description={
                    state.colorMode === "system"
                      ? "Follows your OS setting"
                      : state.colorMode === "dark"
                        ? "Always dark appearance"
                        : "Always light appearance"
                  }
                >
                  <ColorModeSelector
                    value={state.colorMode}
                    onChange={state.handleColorMode}
                  />
                </SettingRow>

                <div className="py-3.5 px-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <div>
                      <div className="text-[13px] text-text font-medium">
                        Opacity
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        Window transparency level
                      </div>
                    </div>
                  </div>
                  <OpacitySlider
                    value={state.opacity}
                    onChange={state.handleOpacityChange}
                    onCommit={state.handleOpacityCommit}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview Column */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                Live Preview
              </span>
              <span className="text-[10px] text-text-muted opacity-70">
                {state.opacity}% opacity · {state.intervalMs / 1000}s refresh
              </span>
            </div>
            <WidgetPreview
              view={view}
              colorMode={state.colorMode}
              opacity={state.opacity}
              intervalMs={state.intervalMs}
            />
            <div className="text-[10px] text-text-muted text-center opacity-60 mt-1">
              Drag the widget on your desktop to reposition
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WidgetSettingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-full">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-[22px] font-semibold text-text tracking-[-0.02em] leading-none mb-1.5">
            Widgets
          </div>
          <div className="text-[12px] text-text-muted font-normal">
            Configure overlay widgets — each runs independently with its own
            settings
          </div>
        </div>
      </div>

      {/* Widget Cards */}
      <div className="flex flex-col gap-0">
        {WIDGET_LABELS.map((label) => (
          <WidgetConfigPanel key={label} widgetLabel={label} />
        ))}
      </div>

      {/* Footer Hint */}
      <div className="mt-6 pt-5 border-t border-border">
        <div className="flex items-start gap-3 text-[11px] text-text-muted">
          <span className="text-[14px] shrink-0 mt-px">💡</span>
          <div className="leading-relaxed">
            <strong className="text-text-subtle font-medium">Tips:</strong>{" "}
            Widgets remember their position between sessions. Use arrow keys to
            fine-tune placement. Each widget has its own theme mode — try dark
            mode for gaming overlays and light mode for productivity.
          </div>
        </div>
      </div>
    </div>
  );
}
