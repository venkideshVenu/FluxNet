import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ColorMode } from "@/utils/theme";
import {
  getStoredPillMode,
  getStoredCompactMode,
  getStoredHudMode,
  LS_PILL_MODE,
  LS_COMPACT_MODE,
  LS_HUD_MODE,
} from "@/utils";
import {
  getStoredPillAlwaysOnTop,
  getStoredCompactAlwaysOnTop,
  getStoredHudAlwaysOnTop,
  LS_PILL_ALWAYS_ON_TOP,
  LS_COMPACT_ALWAYS_ON_TOP,
  LS_HUD_ALWAYS_ON_TOP,
} from "@/utils";
import {
  LS_PILL_INTERVAL,
  LS_COMPACT_INTERVAL,
  LS_HUD_INTERVAL,
  getStoredPillIntervalMs,
  getStoredCompactIntervalMs,
  getStoredHudIntervalMs,
} from "@/utils";
import { PillPresentation } from "@/components";
import { CompactPresentation } from "@/components";
import { HudPresentation } from "@/components";

type WidgetLabel = "pill" | "compact" | "hud";

interface WidgetConfig {
  label: WidgetLabel;
  title: string;
  accentColor: string;
  previewBg: string;
  previewComponent: React.ComponentType<any>; // accepts mock props
  getPreviewProps: (
    colorMode: ColorMode,
    opacity: number,
    intervalMs: number,
  ) => Record<string, any>;
  opacityStorageKey: string;
  modeStorageKey: string;
  alwaysOnTopStorageKey: string;
  intervalStorageKey: string;
  getStoredMode: () => ColorMode;
  getStoredAlwaysOnTop: () => boolean;
  getStoredIntervalMs: () => number;
}

const widgets: WidgetConfig[] = [
  {
    label: "pill",
    title: "Pill Widget",
    accentColor: "#f59e0b",
    previewBg: "linear-gradient(135deg, #0f0d1a 0%, #1a1530 100%)",
    previewComponent: PillPresentation,
    getPreviewProps: () => ({
      downloadValue: "24.5",
      downloadUnit: "MB/s",
      uploadValue: "3.2",
      uploadUnit: "MB/s",
      isConnected: true,
    }),
    opacityStorageKey: "fluxnet_opacity",
    modeStorageKey: LS_PILL_MODE,
    alwaysOnTopStorageKey: LS_PILL_ALWAYS_ON_TOP,
    intervalStorageKey: LS_PILL_INTERVAL,
    getStoredMode: getStoredPillMode,
    getStoredAlwaysOnTop: getStoredPillAlwaysOnTop,
    getStoredIntervalMs: getStoredPillIntervalMs,
  },
  {
    label: "compact",
    title: "Compact Widget",
    accentColor: "#22c97a",
    previewBg: "linear-gradient(135deg, #0d1a14 0%, #111f18 100%)",
    previewComponent: CompactPresentation,
    getPreviewProps: (_mode, _opacity, intervalMs) => ({
      interfaceName: "en0",
      isConnected: true,
      intervalLabel: `${intervalMs / 1000}s`,
      downloadValue: "24.5",
      downloadUnit: "MB/s",
      uploadValue: "3.2",
      uploadUnit: "MB/s",
      todayDownloadValue: "12.3",
      todayDownloadUnit: "GB",
      todayUploadValue: "2.1",
      todayUploadUnit: "GB",
    }),
    opacityStorageKey: "fluxnet_compact_opacity",
    modeStorageKey: LS_COMPACT_MODE,
    alwaysOnTopStorageKey: LS_COMPACT_ALWAYS_ON_TOP,
    intervalStorageKey: LS_COMPACT_INTERVAL,
    getStoredMode: getStoredCompactMode,
    getStoredAlwaysOnTop: getStoredCompactAlwaysOnTop,
    getStoredIntervalMs: getStoredCompactIntervalMs,
  },
  {
    label: "hud",
    title: "HUD Widget",
    accentColor: "#7c6ff7",
    previewBg: "linear-gradient(135deg, #0c0b18 0%, #16142a 100%)",
    previewComponent: HudPresentation,
    getPreviewProps: () => ({
      downloadValue: "24.5",
      downloadUnit: "MB/s",
      uploadValue: "3.2",
      uploadUnit: "MB/s",
      latencyMs: 42,
      lossPercent: 0,
    }),
    opacityStorageKey: "fluxnet_hud_opacity",
    modeStorageKey: LS_HUD_MODE,
    alwaysOnTopStorageKey: LS_HUD_ALWAYS_ON_TOP,
    intervalStorageKey: LS_HUD_INTERVAL,
    getStoredMode: getStoredHudMode,
    getStoredAlwaysOnTop: getStoredHudAlwaysOnTop,
    getStoredIntervalMs: getStoredHudIntervalMs,
  },
];

// Toggle component unchanged
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div
      className={`toggle ${checked ? "on" : "off"}`}
      onClick={onChange}
      role="switch"
      aria-checked={checked}
    >
      <div className="toggle-thumb" />
    </div>
  );
}

function WidgetConfigPanel({ widget }: { widget: WidgetConfig }) {
  const [visible, setVisible] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(widget.getStoredAlwaysOnTop());
  const [opacity, setOpacity] = useState(() => {
    const saved = localStorage.getItem(widget.opacityStorageKey);
    return saved ? Number(saved) : 88;
  });
  const [colorMode, setColorMode] = useState<ColorMode>(widget.getStoredMode());
  const [intervalMs, setIntervalMs] = useState(widget.getStoredIntervalMs());

  useEffect(() => {
    WebviewWindow.getByLabel(widget.label).then((win) =>
      win?.isVisible().then(setVisible),
    );
  }, [widget.label]);

  const toggleVisible = async () => {
    const next = !visible;
    setVisible(next);
    await invoke("set_widget_visibility", {
      label: widget.label,
      visible: next,
    });
  };

  const handleAlwaysOnTop = async (value: boolean) => {
    setAlwaysOnTop(value);
    localStorage.setItem(widget.alwaysOnTopStorageKey, String(value));
    await invoke("set_widget_always_on_top", { label: widget.label, value });
  };

  const handleOpacityCommit = async (value: number) => {
    localStorage.setItem(widget.opacityStorageKey, String(value));
    await invoke("set_widget_opacity", {
      label: widget.label,
      value: value / 100,
    });
  };

  const handleColorMode = (mode: ColorMode) => {
    setColorMode(mode);
    localStorage.setItem(widget.modeStorageKey, mode);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: widget.modeStorageKey,
        newValue: mode,
      }),
    );
  };

  const handleInterval = (raw: string) => {
    const ms = parseFloat(raw) * 1000;
    setIntervalMs(ms);
    localStorage.setItem(widget.intervalStorageKey, String(ms));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: widget.intervalStorageKey,
        newValue: String(ms),
      }),
    );
  };

  const intervalOptions = [
    { value: "0.5", label: "0.5 seconds" },
    { value: "1", label: "1 second" },
    { value: "2", label: "2 seconds" },
    { value: "5", label: "5 seconds" },
  ];

  const Preview = widget.previewComponent;
  const previewProps = widget.getPreviewProps(colorMode, opacity, intervalMs);

  return (
    <div className="widget-section">
      <div
        className="settings-section-title"
        style={{ color: widget.accentColor }}
      >
        {widget.title}
      </div>
      <div className="widget-section-body">
        <div className="widget-settings-panel">
          <div
            className="settings-card"
            style={{ borderTop: `2px solid ${widget.accentColor}22` }}
          >
            <div className="settings-row">
              <div>
                <div className="settings-label">Always on top</div>
                <div className="settings-sub">Float above all windows</div>
              </div>
              <Toggle
                checked={alwaysOnTop}
                onChange={() => handleAlwaysOnTop(!alwaysOnTop)}
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
                  handleColorMode(colorMode === "dark" ? "light" : "dark")
                }
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
                onChange={(e) => handleInterval(e.target.value)}
              >
                {intervalOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
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
                onChange={(e) => setOpacity(Number(e.target.value))}
                onMouseUp={(e) =>
                  handleOpacityCommit(
                    Number((e.target as HTMLInputElement).value),
                  )
                }
                onTouchEnd={(e) =>
                  handleOpacityCommit(
                    Number((e.target as HTMLInputElement).value),
                  )
                }
              />
            </div>
          </div>
        </div>
        <div
          className="widget-preview-panel"
          style={{ background: widget.previewBg }}
        >
          <div className="preview-content">
            <Preview {...previewProps} />
          </div>
        </div>
        <button
          className={`visibility-btn ${visible ? "visible" : "hidden"}`}
          onClick={toggleVisible}
          style={{ color: widget.accentColor }}
        >
          <span
            className="visibility-btn-dot"
            style={{ background: widget.accentColor }}
          />
          {visible ? "Hide Widget" : "Show Widget"}
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
      {widgets.map((w) => (
        <WidgetConfigPanel key={w.label} widget={w} />
      ))}
    </div>
  );
}
