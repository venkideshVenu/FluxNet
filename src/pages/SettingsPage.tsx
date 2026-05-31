import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkStore, DisplayUnits } from "../store/networkStore";
import {
  THEMES,
  LS_THEME,
  LS_MODE,
  applyAccent,
  applyColorMode,
  getStoredAccentIndex,
  getStoredColorMode,
  ColorMode,
} from "../utils/theme";

export function SettingsPage() {
  const pollIntervalMs = useNetworkStore((s) => s.pollIntervalMs);
  const displayUnits = useNetworkStore((s) => s.displayUnits);
  const setPollInterval = useNetworkStore((s) => s.setPollInterval);
  const setDisplayUnits = useNetworkStore((s) => s.setDisplayUnits);

  const intervalSelectValue = String(pollIntervalMs / 1000);

  const [startWithOS, setStartWithOS] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(() =>
    getStoredAccentIndex(),
  );
  const [colorMode, setColorMode] = useState<ColorMode>(() =>
    getStoredColorMode(),
  );

  useEffect(() => {
    const swatch = THEMES[selectedTheme] ?? THEMES[0];
    applyAccent(swatch.color);
  }, [selectedTheme]);

  useEffect(() => {
    applyColorMode(colorMode);
  }, [colorMode]);

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
      // tauri-plugin-autostart may not be configured
      console.warn("autostart not available:", err);
    }
  };

  const handleTheme = (index: number) => {
    setSelectedTheme(index);
    localStorage.setItem(LS_THEME, String(index));
  };

  const handleColorMode = (mode: ColorMode) => {
    setColorMode(mode);
    localStorage.setItem(LS_MODE, mode);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">
            Customize FluxNet behavior and appearance
          </div>
        </div>
      </div>

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

      <div className="settings-section">
        <div className="settings-section-title">Appearance</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Dark mode</div>
              <div className="settings-sub">Switch between light and dark</div>
            </div>
            <div
              className={`toggle ${colorMode === "dark" ? "on" : "off"}`}
              onClick={() =>
                handleColorMode(colorMode === "dark" ? "light" : "dark")
              }
              role="switch"
              aria-checked={colorMode === "dark"}
            >
              <div className="toggle-thumb" />
            </div>
          </div>

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
