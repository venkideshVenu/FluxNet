import { useEffect, useState, type ReactNode } from "react";
import { Gamepad2, PanelTop, RectangleHorizontal } from "lucide-react";
import {
  cacheHudDesign,
  getCachedHudDesign,
  parseHudDesign,
  type ColorMode,
} from "@/utils";
import { invoke } from "@/api";
import { WIDGET_LABELS, type WidgetLabel } from "@/config";
import { useWidgetPanelState } from "@/hooks";
import { WIDGET_VIEWS, WidgetPreview } from "@/components";
import type { HudDesign } from "@/components/HudPresentation";
import {
  ComboBox,
  Page,
  PageHeader,
  SettingsExpander,
  SettingsExpanderItem,
  Slider,
  ToggleSwitch,
} from "@/components/fluent";

const WIDGET_INFO: Record<
  WidgetLabel,
  { name: string; description: string; icon: ReactNode }
> = {
  pill: {
    name: "Pill",
    description: "Download and upload speed in a slim bar",
    icon: <RectangleHorizontal />,
  },
  compact: {
    name: "Compact",
    description: "Speeds, connection and today's totals",
    icon: <PanelTop />,
  },
  hud: {
    name: "Game overlay",
    description: "Speed, ping and packet loss on top of games",
    icon: <Gamepad2 />,
  },
};

const REFRESH_OPTIONS = [
  { value: "0.5", label: "Every 0.5 seconds" },
  { value: "1", label: "Every second" },
  { value: "2", label: "Every 2 seconds" },
  { value: "5", label: "Every 5 seconds" },
];

const THEME_OPTIONS: { value: ColorMode; label: string }[] = [
  { value: "system", label: "Use system setting" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const LAYOUT_OPTIONS: { value: HudDesign; label: string }[] = [
  { value: "horizontal", label: "Horizontal bar" },
  { value: "vertical", label: "Vertical card" },
];

/** Slider bounds; mirrored by the backend's opacity clamp. */
export const MIN_OPACITY = 40;
export const MAX_OPACITY = 100;

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
    <Slider
      label="Opacity"
      min={MIN_OPACITY}
      max={MAX_OPACITY}
      value={value}
      valueText={`${value}%`}
      onChange={onChange}
      onCommit={onCommit}
    />
  );
}

function WidgetPanel({ label }: { label: WidgetLabel }) {
  const view = WIDGET_VIEWS[label];
  const info = WIDGET_INFO[label];
  const state = useWidgetPanelState(view.entry);

  // HUD layout: the backend is authoritative; localStorage is only a cache
  // the HUD window reads for its first frame.
  const [hudDesign, setHudDesign] = useState<HudDesign>(getCachedHudDesign);

  useEffect(() => {
    if (label !== "hud") return;
    let alive = true;
    invoke<string>("get_hud_design")
      .then((value) => {
        const design = parseHudDesign(value);
        if (alive && design) {
          setHudDesign(design);
          cacheHudDesign(design);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [label]);

  const handleLayout = async (design: HudDesign) => {
    const previous = hudDesign;
    setHudDesign(design);
    try {
      await invoke("set_hud_design", { design });
      cacheHudDesign(design);
    } catch (e) {
      console.error("Failed to set HUD layout:", e);
      setHudDesign(previous);
    }
  };

  return (
    <SettingsExpander
      icon={info.icon}
      header={info.name}
      description={info.description}
      headerControl={
        <ToggleSwitch
          label={`Show ${info.name}`}
          checked={state.visible === true}
          disabled={state.visible === null}
          onChange={() => void state.toggleVisible()}
        />
      }
    >
      <div className="flex min-h-24 items-center justify-center bg-[linear-gradient(135deg,#d9e3ee,#e8e0ea)] px-4 py-6 in-data-[theme=dark]:bg-[linear-gradient(135deg,#1d2733,#2a2230)]">
        <WidgetPreview
          view={view}
          colorMode={state.colorMode}
          opacity={state.opacity}
          intervalMs={state.intervalMs}
          hudDesign={label === "hud" ? hudDesign : undefined}
          frameClassName="flex items-center justify-center"
        />
      </div>
      {label === "hud" && (
        <SettingsExpanderItem header="Layout">
          <ComboBox
            label="Layout"
            value={hudDesign}
            options={LAYOUT_OPTIONS}
            onChange={(d) => void handleLayout(d)}
          />
        </SettingsExpanderItem>
      )}
      <SettingsExpanderItem header="Keep on top of other windows">
        <ToggleSwitch
          label="Keep on top of other windows"
          checked={state.alwaysOnTop}
          onChange={(v) => void state.handleAlwaysOnTop(v)}
        />
      </SettingsExpanderItem>
      <SettingsExpanderItem header="Refresh rate">
        <ComboBox
          label="Refresh rate"
          value={String(state.intervalMs / 1000)}
          options={REFRESH_OPTIONS}
          onChange={state.handleInterval}
        />
      </SettingsExpanderItem>
      <SettingsExpanderItem header="Theme">
        <ComboBox
          label="Theme"
          value={state.colorMode}
          options={THEME_OPTIONS}
          onChange={state.handleColorMode}
        />
      </SettingsExpanderItem>
      <SettingsExpanderItem header="Opacity">
        <OpacitySlider
          value={state.opacity}
          onChange={state.handleOpacityChange}
          onCommit={(v) => void state.handleOpacityCommit(v)}
        />
      </SettingsExpanderItem>
    </SettingsExpander>
  );
}

export function WidgetSettingsPage() {
  return (
    <Page>
      <PageHeader title="Widgets" />
      <div className="flex flex-col gap-1">
        {WIDGET_LABELS.map((label) => (
          <WidgetPanel key={label} label={label} />
        ))}
      </div>
      <p className="mt-4 px-0.5 text-caption text-fg-secondary">
        Drag a widget to move it. With a widget selected, the arrow keys nudge
        it; hold Shift to move it further. Widgets reopen where you left them.
      </p>
    </Page>
  );
}
