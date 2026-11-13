import { useEffect, useState } from "react";
import { ColorMode, getStoredHudDesign } from "@/utils";
import { Toggle } from "@/components";
import { WIDGET_LABELS, WidgetLabel } from "@/config";
import { useWidgetPanelState } from "@/hooks";
import { WIDGET_VIEWS, WidgetPreview } from "@/components";
import type { HudDesign } from "@/components/HudPresentation";

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

const COLOR_MODE_OPTIONS: {
  value: ColorMode;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "system", label: "System", icon: <IconMonitor /> },
  { value: "dark", label: "Dark", icon: <IconMoon /> },
  { value: "light", label: "Light", icon: <IconSun /> },
];

const HUD_DESIGN_OPTIONS: {
  value: HudDesign;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "horizontal", label: "Horizontal", icon: <IconHorizontal /> },
  { value: "vertical", label: "Vertical", icon: <IconVertical /> },
];

// ── Icons ───────────────────────────────────────────────────────────────────

function IconHorizontal() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="7" width="20" height="10" rx="5" />
    </svg>
  );
}

function IconVertical() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="2" width="14" height="20" rx="3" />
      <line x1="5" y1="8" x2="19" y2="8" />
      <line x1="5" y1="16" x2="19" y2="16" />
    </svg>
  );
}

function IconMonitor() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function IconSliders() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="currentColor" />
      <circle cx="16" cy="12" r="2" fill="currentColor" />
      <circle cx="11" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}

function IconPalette() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22a9.5 9.5 0 1 1 0-19 8.5 8.5 0 0 1 8.5 8.5c0 2-1.5 3-3 3h-2.3a1.7 1.7 0 0 0-1 3.1A1.9 1.9 0 0 1 13 21a1.9 1.9 0 0 1-1 1Z" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="11" cy="6.5" r="1" fill="currentColor" />
      <circle cx="16" cy="7.5" r="1" fill="currentColor" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 11 7 11 7a13.2 13.2 0 0 1-2.16 2.94" />
      <path d="M6.1 6.1A13.6 13.6 0 0 0 1 11s4 7 11 7a9.2 9.2 0 0 0 4.9-1.4" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

export function OpacitySlider({
  value,
  onChange,
  onCommit,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={40}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        // Commit when a drag ends (mouse, touch or pen) and after keyboard
        // changes (arrows, Home/End, PageUp/PageDown), which never fire
        // pointer events.
        onPointerUp={(e) => onCommit(Number(e.currentTarget.value))}
        onKeyUp={(e) => onCommit(Number(e.currentTarget.value))}
        aria-label="Opacity"
        style={{
          background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((value - 40) / 60) * 100}%, var(--border) ${((value - 40) / 60) * 100}%, var(--border) 100%)`,
        }}
        className="flex-1 min-w-24 h-1.5 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_var(--accent-soft),0_2px_6px_rgba(0,0,0,0.15)] [&::-webkit-slider-thumb]:transition-shadow [&::-webkit-slider-thumb]:hover:shadow-[0_0_0_4px_var(--accent-soft),0_2px_8px_rgba(0,0,0,0.2)]
          [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-[0_0_0_3px_var(--accent-soft)]"
      />
      <span className="text-[12px] font-mono font-semibold text-text w-10 text-right tabular-nums shrink-0">
        {value}%
      </span>
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-surface border border-border max-w-full overflow-x-auto scrollbar-none">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all whitespace-nowrap ${
            value === option.value
              ? "bg-accent text-white shadow-[0_2px_8px_var(--accent-shadow)]"
              : "text-text-muted hover:text-text hover:bg-panel-hover"
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
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
    <SegmentedControl
      options={COLOR_MODE_OPTIONS}
      value={value}
      onChange={onChange}
    />
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
    <SegmentedControl
      options={INTERVAL_OPTIONS}
      value={currentValue}
      onChange={onChange}
    />
  );
}

function HudDesignSelector({
  value,
  onChange,
}: {
  value: HudDesign;
  onChange: (design: HudDesign) => void;
}) {
  return (
    <SegmentedControl
      options={HUD_DESIGN_OPTIONS}
      value={value}
      onChange={onChange}
    />
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
    <div className="flex flex-wrap items-center justify-between gap-3 py-3.5 px-4 transition-colors hover:bg-panel-hover">
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

function SettingsGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border text-text-muted">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {title}
        </span>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

// ── Settings Summary (shown when collapsed) ───────────────────────────────────

function SettingsSummary({
  colorMode,
  opacity,
  intervalMs,
  alwaysOnTop,
  hudDesign,
  widgetLabel,
}: {
  colorMode: ColorMode;
  opacity: number;
  intervalMs: number;
  alwaysOnTop: boolean;
  hudDesign?: HudDesign;
  widgetLabel: WidgetLabel;
}) {
  const modeLabel =
    colorMode === "system" ? "System" : colorMode === "dark" ? "Dark" : "Light";

  return (
    <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-border">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-surface border border-border text-text-muted">
        <IconPalette /> {modeLabel}
      </span>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-surface border border-border text-text-muted">
        {opacity}% opacity
      </span>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-surface border border-border text-text-muted">
        {intervalMs / 1000}s refresh
      </span>
      {alwaysOnTop && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-surface border border-border text-text-muted">
          Always on top
        </span>
      )}
      {widgetLabel === "hud" && hudDesign && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-surface border border-border text-text-muted">
          {hudDesign === "vertical" ? <IconVertical /> : <IconHorizontal />}{" "}
          {hudDesign === "vertical" ? "Vertical" : "Horizontal"}
        </span>
      )}
    </div>
  );
}

// ── Main Widget Panel ─────────────────────────────────────────────────────────

function WidgetConfigPanel({ widgetLabel }: { widgetLabel: WidgetLabel }) {
  const view = WIDGET_VIEWS[widgetLabel];
  const config = view.entry;
  const state = useWidgetPanelState(config);
  const [isExpanded, setIsExpanded] = useState(false);

  // HUD design state
  const [hudDesign, setHudDesign] = useState<HudDesign>(getStoredHudDesign);

  const handleHudDesignChange = async (design: HudDesign) => {
    setHudDesign(design);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_hud_design", { design });
    } catch (e) {
      console.error("Failed to set hud design:", e);
    }
  };

  useEffect(() => {
    if (widgetLabel === "hud") {
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke<string>("get_hud_design")
          .then((d) => setHudDesign(d as HudDesign))
          .catch(() => {});
      });
    }
  }, [widgetLabel]);

  const opacityDescription =
    state.opacity >= 95
      ? "Fully opaque"
      : state.opacity <= 55
        ? "Very transparent"
        : "Partially transparent";

  const themeDescription =
    state.colorMode === "system"
      ? "Follows your OS setting"
      : state.colorMode === "dark"
        ? "Always dark appearance"
        : "Always light appearance";

  return (
    <section className="rounded-2xl border border-border bg-panel shadow-sm overflow-hidden">
      {/* Widget Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-semibold text-text">
                {config.displayName}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  state.visible
                    ? "bg-success-bg text-success"
                    : "bg-surface text-text-muted"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    state.visible
                      ? "bg-success shadow-[0_0_6px_var(--success)]"
                      : "bg-text-muted opacity-50"
                  }`}
                />
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
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all border disabled:opacity-50 disabled:cursor-not-allowed ${
              state.visible
                ? "bg-surface text-text-muted border-border hover:border-border-strong hover:text-text hover:bg-panel-hover"
                : "bg-accent text-white border-transparent hover:opacity-90 shadow-[0_2px_8px_var(--accent-shadow)]"
            }`}
          >
            {state.visible === null ? (
              "…"
            ) : state.visible ? (
              <>
                <IconEyeOff /> Hide
              </>
            ) : (
              <>
                <IconEye /> Show
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-7 h-7 rounded-lg border border-border bg-surface text-text-muted flex items-center justify-center cursor-pointer hover:border-accent-border hover:text-text transition-all"
            aria-label={isExpanded ? "Collapse settings" : "Expand settings"}
            aria-expanded={isExpanded}
          >
            <IconChevronDown
              className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Settings Summary (shown when collapsed) */}
      {!isExpanded && (
        <SettingsSummary
          colorMode={state.colorMode}
          opacity={state.opacity}
          intervalMs={state.intervalMs}
          alwaysOnTop={state.alwaysOnTop}
          hudDesign={widgetLabel === "hud" ? hudDesign : undefined}
          widgetLabel={widgetLabel}
        />
      )}

      {/* Expandable Content */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Preview strip */}
          <div className="flex flex-col items-center border-b border-border bg-surface/40">
            <WidgetPreview
              view={view}
              colorMode={state.colorMode}
              opacity={state.opacity}
              intervalMs={state.intervalMs}
              hudDesign={widgetLabel === "hud" ? hudDesign : undefined}
            />
            <div className="flex items-center gap-3 pb-3 text-[10px] text-text-muted">
              <span className="font-mono bg-surface border border-border rounded-full px-2 py-0.5">
                {state.opacity}% opacity
              </span>
              <span className="opacity-40">·</span>
              <span className="font-mono bg-surface border border-border rounded-full px-2 py-0.5">
                {state.intervalMs / 1000}s refresh
              </span>
            </div>
          </div>

          {/* Settings */}
          <div className="px-5 py-5 flex flex-col gap-4">
            <SettingsGroup title="Behavior" icon={<IconSliders />}>
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
            </SettingsGroup>

            <SettingsGroup title="Appearance" icon={<IconPalette />}>
              {widgetLabel === "hud" && (
                <SettingRow
                  label="Design layout"
                  description={
                    hudDesign === "vertical"
                      ? "Vertical card with separated sections"
                      : "Compact horizontal pill bar"
                  }
                >
                  <HudDesignSelector
                    value={hudDesign}
                    onChange={handleHudDesignChange}
                  />
                </SettingRow>
              )}
              <SettingRow label="Theme mode" description={themeDescription}>
                <ColorModeSelector
                  value={state.colorMode}
                  onChange={state.handleColorMode}
                />
              </SettingRow>

              <SettingRow label="Opacity" description={opacityDescription}>
                <div className="w-48 max-w-full">
                  <OpacitySlider
                    value={state.opacity}
                    onChange={state.handleOpacityChange}
                    onCommit={state.handleOpacityCommit}
                  />
                </div>
              </SettingRow>
            </SettingsGroup>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WidgetSettingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-full">
      {/* Page Header */}
      <div className="mb-7">
        <div className="text-[22px] font-semibold text-text tracking-[-0.02em] leading-none mb-1.5">
          Widgets
        </div>
        <div className="text-[12px] text-text-muted font-normal">
          Configure overlay widgets — each runs independently with its own
          settings
        </div>
      </div>

      {/* Widget Cards */}
      <div className="flex flex-col gap-5">
        {WIDGET_LABELS.map((label) => (
          <WidgetConfigPanel key={label} widgetLabel={label} />
        ))}
      </div>

      {/* Footer Hint */}
      <div className="mt-6 rounded-xl border border-border bg-surface px-4 py-3.5">
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
