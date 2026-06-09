import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore, DisplayUnits } from "@/store";
import {
  THEMES,
  applyAccent,
  applyColorMode,
  getStoredAccentIndex,
  getStoredColorMode,
  ColorMode,
  setStorageItem,
} from "@/utils";

export function SettingsPage() {
  const pollIntervalMs = useSettingsStore((s) => s.pollIntervalMs);
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const pingTarget = useSettingsStore((s) => s.pingTarget);
  const setPollInterval = useSettingsStore((s) => s.setPollInterval);
  const setDisplayUnits = useSettingsStore((s) => s.setDisplayUnits);
  const setPingTarget = useSettingsStore((s) => s.setPingTarget);

  const [startWithOS, setStartWithOS] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(getStoredAccentIndex);
  const [colorMode, setColorMode] = useState<ColorMode>(getStoredColorMode);

  // Load backend-only settings on mount
  useEffect(() => {
    invoke<number>("get_refresh_interval")
      .then((ms) => setPollInterval(ms))
      .catch(console.warn);
    invoke<string>("get_ping_target")
      .then((target) => setPingTarget(target))
      .catch(console.warn);
    invoke<boolean>("autostart:is-enabled")
      .then((enabled) => setStartWithOS(enabled))
      .catch(() => setStartWithOS(false));
  }, [setPollInterval, setPingTarget]);

  // Theme & color mode effects
  useEffect(() => {
    applyAccent(THEMES[selectedTheme]?.color ?? THEMES[0].color);
  }, [selectedTheme]);
  useEffect(() => {
    applyColorMode(colorMode);
  }, [colorMode]);

  const handleInterval = async (raw: string) => {
    const secs = parseFloat(raw);
    const ms = secs * 1000;
    setPollInterval(ms);
    await invoke("set_refresh_interval", { intervalMs: ms });
  };

  const handleUnits = (raw: string) => setDisplayUnits(raw as DisplayUnits);

  const handleStartWithOS = async (value: boolean) => {
    setStartWithOS(value);
    try {
      if (value) await invoke("autostart:enable");
      else await invoke("autostart:disable");
    } catch (err) {
      console.warn("autostart not available:", err);
    }
  };

  const handlePingTarget = async (target: string) => {
    setPingTarget(target);
    await invoke("set_ping_target", { target }).catch(console.warn);
  };

  const handleTheme = (index: number) => {
    setSelectedTheme(index);
    setStorageItem("fluxnet_accent_index", index);
  };

  const handleColorMode = (mode: ColorMode) => {
    setColorMode(mode);
    setStorageItem("fluxnet_color_mode", mode);
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
              value={String(pollIntervalMs / 1000)}
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
              <div className="settings-label">Ping target</div>
              <div className="settings-sub">
                IP or hostname to ping for latency
              </div>
            </div>
            <input
              type="text"
              className="fn-input"
              value={pingTarget}
              onChange={(e) => handlePingTarget(e.target.value)}
              style={{ width: 160, fontFamily: "monospace" }}
            />
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
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  handleStartWithOS(!startWithOS);
                }
              }}
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
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  handleColorMode(colorMode === "dark" ? "light" : "dark");
                }
              }}
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
                <button
                  key={i}
                  type="button"
                  className={`theme-chip ${selectedTheme === i ? "selected" : ""}`}
                  style={{ background: t.color }}
                  title={t.label}
                  aria-label={`${t.label} theme${selectedTheme === i ? " (active)" : ""}`}
                  aria-pressed={selectedTheme === i}
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
              type="button"
              onClick={() => invoke("reset_peaks")}
              className="btn-danger"
            >
              Reset peaks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
