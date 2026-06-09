import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ColorMode } from "@/utils";
import { Toggle } from "@/components";
import { PillPresentation } from "@/components";
import { CompactPresentation } from "@/components";
import { HudPresentation } from "@/components";
import {
  WIDGET_REGISTRY,
  WIDGET_LABELS,
  WidgetLabel,
  WidgetRegistryEntry,
} from "@/config";

interface WidgetViewConfig {
  entry: WidgetRegistryEntry;
  previewComponent: React.ComponentType<any>;
  getPreviewProps: (
    colorMode: ColorMode,
    opacity: number,
    intervalMs: number,
  ) => Record<string, unknown>;
}

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
      downloadValue: "24.5",
      downloadUnit: "MB/s",
      uploadValue: "3.2",
      uploadUnit: "MB/s",
      todayDownloadValue: "12.3",
      todayDownloadUnit: "GB",
      todayUploadValue: "2.1",
      todayUploadUnit: "GB",
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

function WidgetConfigPanel({ widgetLabel }: { widgetLabel: WidgetLabel }) {
  const view = WIDGET_VIEWS[widgetLabel];
  const config = view.entry;

  const [visible, setVisible] = useState<boolean | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = useState(config.getStoredAlwaysOnTop());
  const [opacity, setOpacity] = useState(() => {
    const saved = localStorage.getItem(config.opacityKey);
    return saved ? Number(saved) : config.defaultOpacity;
  });
  const [colorMode, setColorMode] = useState<ColorMode>(config.getStoredMode());
  const [intervalMs, setIntervalMs] = useState(config.getStoredInterval());

  useEffect(() => {
    WebviewWindow.getByLabel(config.label).then((win) => {
      if (win) {
        win.isVisible().then(setVisible);
      } else {
        setVisible(false);
      }
    });
  }, [config.label]);

  const toggleVisible = async () => {
    const next = !visible;
    setVisible(next);
    await invoke("set_widget_visibility", {
      label: config.label,
      visible: next,
    });
  };

  const handleAlwaysOnTop = async (value: boolean) => {
    setAlwaysOnTop(value);
    localStorage.setItem(config.alwaysOnTopKey, String(value));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: config.alwaysOnTopKey,
        newValue: String(value),
      }),
    );
    await invoke("set_widget_always_on_top", { label: config.label, value });
  };

  const handleOpacityCommit = async (value: number) => {
    localStorage.setItem(config.opacityKey, String(value));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: config.opacityKey,
        newValue: String(value),
      }),
    );
    await invoke("set_widget_opacity", {
      label: config.label,
      value: value / 100,
    });
  };

  const handleColorMode = (mode: ColorMode) => {
    setColorMode(mode);
    localStorage.setItem(config.modeKey, mode);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: config.modeKey,
        newValue: mode,
      }),
    );
  };

  const handleInterval = (raw: string) => {
    const ms = parseFloat(raw) * 1000;
    setIntervalMs(ms);
    localStorage.setItem(config.intervalKey, String(ms));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: config.intervalKey,
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

  const Preview = view.previewComponent;
  const previewProps = view.getPreviewProps(colorMode, opacity, intervalMs);

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
            <div className="settings-row">
              <div>
                <div className="settings-label">Always on top</div>
                <div className="settings-sub">Float above all windows</div>
              </div>
              <Toggle
                checked={alwaysOnTop}
                onChange={() => handleAlwaysOnTop(!alwaysOnTop)}
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
                  handleColorMode(colorMode === "dark" ? "light" : "dark")
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
          style={{ background: config.previewBg }}
        >
          <div className="preview-content">
            <Preview {...previewProps} />
          </div>
        </div>
        <button
          className={`visibility-btn ${visible ? "visible" : "hidden"}`}
          onClick={toggleVisible}
          disabled={visible === null}
          style={{ color: config.accentColor }}
        >
          <span
            className="visibility-btn-dot"
            style={{ background: config.accentColor }}
          />
          {visible === null
            ? "Loading…"
            : visible
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
