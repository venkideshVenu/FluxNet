import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useNetworkStore, DisplayUnits } from "../store/networkStore";

const THEMES = [
  { color: "#7C6FF7", label: "Violet" },
  { color: "#22C97A", label: "Mint" },
  { color: "#4FBBF7", label: "Sky" },
  { color: "#F59E0B", label: "Amber" },
  { color: "#EF4444", label: "Coral" },
  { color: "#1A1830", label: "Midnight" },
];

// localStorage keys
const LS_THEME = "fluxnet_accent_index";
const LS_OPACITY = "fluxnet_opacity";

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb | null {
  const normalized = hex.trim().replace("#", "");
  if (normalized.length !== 6) return null;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)
    ? null
    : { r, g, b };
}

function mixRgb(a: Rgb, b: Rgb, ratio: number): Rgb {
  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  return {
    r: clamp(Math.round(a.r + (b.r - a.r) * ratio)),
    g: clamp(Math.round(a.g + (b.g - a.g) * ratio)),
    b: clamp(Math.round(a.b + (b.b - a.b) * ratio)),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Apply the accent colour as CSS variables on <html> */
function applyAccent(color: string) {
  const root = document.documentElement.style;
  root.setProperty("--accent", color);

  const rgb = hexToRgb(color);
  if (!rgb) return;

  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  root.setProperty("--accent-strong", rgbToHex(mixRgb(rgb, black, 0.25)));
  root.setProperty("--accent-soft", rgbToHex(mixRgb(rgb, white, 0.9)));
  root.setProperty("--accent-soft-2", rgbToHex(mixRgb(rgb, white, 0.94)));
  root.setProperty("--accent-border", rgbToHex(mixRgb(rgb, white, 0.7)));
  root.setProperty("--accent-muted", rgbToHex(mixRgb(rgb, white, 0.8)));
  root.setProperty(
    "--accent-shadow",
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
  );
}

export function SettingsPage() {
  // ── Pill visibility (unchanged — already worked) ──────────
  const [pillVisible, setPillVisible] = useState(false);

  // ── Always-on-top ─────────────────────────────────────────
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);

  // ── Opacity ───────────────────────────────────────────────
  const [opacity, setOpacity] = useState(() => {
    const saved = localStorage.getItem(LS_OPACITY);
    return saved ? Number(saved) : 88;
  });

  // ── Interval + units — live in the store ──────────────────
  const pollIntervalMs = useNetworkStore((s) => s.pollIntervalMs);
  const displayUnits = useNetworkStore((s) => s.displayUnits);
  const setPollInterval = useNetworkStore((s) => s.setPollInterval);
  const setDisplayUnits = useNetworkStore((s) => s.setDisplayUnits);

  // Convert the store's ms value back to the select's string value
  const intervalSelectValue = String(pollIntervalMs / 1000);

  // ── Start with OS ─────────────────────────────────────────
  const [startWithOS, setStartWithOS] = useState(false);

  // ── Accent theme ──────────────────────────────────────────
  const [selectedTheme, setSelectedTheme] = useState(() => {
    const saved = localStorage.getItem(LS_THEME);
    return saved ? Number(saved) : 0;
  });

  // ── Sync pill visibility on mount ─────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const pill = await WebviewWindow.getByLabel("pill");
        if (!pill) return;
        setPillVisible(await pill.isVisible());
      } catch (err) {
        console.warn("pill window check failed:", err);
      }
    })();
  }, []);

  // Apply saved accent on mount
  useEffect(() => {
    applyAccent(THEMES[selectedTheme].color);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────

  const togglePill = async () => {
    try {
      const pill = await WebviewWindow.getByLabel("pill");
      if (!pill) return;
      if (pillVisible) await pill.hide();
      else await pill.show();
      setPillVisible((v) => !v);
    } catch (err) {
      console.error("pill toggle failed:", err);
    }
  };

  const handleAlwaysOnTop = async (value: boolean) => {
    setAlwaysOnTop(value);
    try {
      // Targets the pill window specifically
      await invoke("set_pill_always_on_top", { value });
    } catch (err) {
      console.error("set_always_on_top failed:", err);
    }
  };

  const handleOpacityCommit = async (value: number) => {
    localStorage.setItem(LS_OPACITY, String(value));
    try {
      await invoke("set_pill_opacity", { value: value / 100 });
    } catch (err) {
      console.error("set_pill_opacity failed:", err);
    }
  };

  const handleInterval = (raw: string) => {
    const secs = parseFloat(raw);
    setPollInterval(secs * 1000);
  };

  const handleUnits = (raw: string) => {
    setDisplayUnits(raw as DisplayUnits);
  };

  const handleStartWithOS = async (value: boolean) => {
    setStartWithOS(value);
    try {
      if (value) await invoke("enable_autostart");
      else await invoke("disable_autostart");
    } catch (err) {
      // tauri-plugin-autostart may not be configured — degrade gracefully
      console.warn("autostart not available:", err);
    }
  };

  const handleTheme = (index: number) => {
    setSelectedTheme(index);
    localStorage.setItem(LS_THEME, String(index));
    applyAccent(THEMES[index].color);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">
            Customize FluxNet behaviour and appearance
          </div>
        </div>
      </div>

      {/* Widget section */}
      <div className="settings-section">
        <div className="settings-section-title">Widget</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Pill widget</div>
              <div className="settings-sub">
                Show or hide the floating widget
              </div>
            </div>
            <div
              className={`toggle ${pillVisible ? "on" : "off"}`}
              onClick={togglePill}
              role="switch"
              aria-checked={pillVisible}
            >
              <div className="toggle-thumb" />
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Always on top</div>
              <div className="settings-sub">
                Float the pill widget above all windows
              </div>
            </div>
            <div
              className={`toggle ${alwaysOnTop ? "on" : "off"}`}
              onClick={() => handleAlwaysOnTop(!alwaysOnTop)}
              role="switch"
              aria-checked={alwaysOnTop}
            >
              <div className="toggle-thumb" />
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Widget opacity</div>
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

      {/* Monitoring section */}
      <div className="settings-section">
        <div className="settings-section-title">Monitoring</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Refresh interval</div>
              <div className="settings-sub">How often to poll network data</div>
            </div>
            <select
              className="fn-select"
              value={intervalSelectValue}
              onChange={(e) => handleInterval(e.target.value)}
            >
              <option value="0.5">0.5 seconds</option>
              <option value="1">1 second</option>
              <option value="2">2 seconds</option>
              <option value="5">5 seconds</option>
            </select>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Display units</div>
              <div className="settings-sub">How speeds are formatted</div>
            </div>
            <select
              className="fn-select"
              value={displayUnits}
              onChange={(e) => handleUnits(e.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="MB/s">MB/s</option>
              <option value="KB/s">KB/s</option>
              <option value="Mbps">Mbps</option>
            </select>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Start with Windows</div>
              <div className="settings-sub">Launch FluxNet at login</div>
            </div>
            <div
              className={`toggle ${startWithOS ? "on" : "off"}`}
              onClick={() => handleStartWithOS(!startWithOS)}
              role="switch"
              aria-checked={startWithOS}
            >
              <div className="toggle-thumb" />
            </div>
          </div>
        </div>
      </div>

      {/* Appearance section */}
      <div className="settings-section">
        <div className="settings-section-title">Appearance</div>
        <div className="settings-card">
          <div
            className="settings-row"
            style={{
              alignItems: "flex-start",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div className="settings-label">Accent colour</div>
            <div className="theme-chips">
              {THEMES.map((t, i) => (
                <div
                  key={i}
                  className={`theme-chip ${selectedTheme === i ? "selected" : ""}`}
                  style={{ background: t.color }}
                  title={t.label}
                  onClick={() => handleTheme(i)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Data section */}
      <div className="settings-section">
        <div className="settings-section-title">Data</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Reset peak values</div>
              <div className="settings-sub">
                Clear session peak upload and download
              </div>
            </div>
            <button
              onClick={() => invoke("reset_peaks")}
              style={{
                background: "#FFF0F0",
                color: "#DC2626",
                border: "1px solid #FECACA",
                borderRadius: 7,
                padding: "5px 12px",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Reset peaks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
