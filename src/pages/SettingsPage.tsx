import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore, DisplayUnits } from "@/store";
import { useNetworkStore } from "@/store";
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

  const resetPeaks = useNetworkStore((s) => s.resetPeaks);

  const [startWithOS, setStartWithOS] = useState(false);
  const [autostartAvailable, setAutostartAvailable] = useState(true);
  const [autostartError, setAutostartError] = useState<string | null>(null);

  const [selectedTheme, setSelectedTheme] = useState(getStoredAccentIndex);
  const [colorMode, setColorMode] = useState<ColorMode>(getStoredColorMode);
  const [localPingTarget, setLocalPingTarget] = useState(pingTarget);

  const pingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    invoke<number>("get_refresh_interval")
      .then((ms) => setPollInterval(ms))
      .catch(console.warn);
    invoke<string>("get_ping_target")
      .then((target) => {
        setPingTarget(target);
        setLocalPingTarget(target);
      })
      .catch(console.warn);

    // Tauri 2 autostart plugin commands use "plugin:autostart|command" format
    invoke<boolean>("plugin:autostart|is_enabled")
      .then((enabled) => {
        setStartWithOS(enabled);
        setAutostartAvailable(true);
      })
      .catch((err) => {
        setStartWithOS(false);
        setAutostartAvailable(false);
        setAutostartError("Autostart plugin not available. Feature disabled.");
        console.warn("autostart not available:", err);
      });
  }, [setPollInterval, setPingTarget]);

  useEffect(() => {
    setLocalPingTarget(pingTarget);
  }, [pingTarget]);

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
    await invoke("set_refresh_interval", { intervalMs: ms }).catch(
      console.warn,
    );
  };

  const handleUnits = (raw: string) => setDisplayUnits(raw as DisplayUnits);

  const handleStartWithOS = async (value: boolean) => {
    if (!autostartAvailable) return;
    setStartWithOS(value);
    setAutostartError(null);
    try {
      if (value) await invoke("plugin:autostart|enable");
      else await invoke("plugin:autostart|disable");
    } catch (err) {
      setAutostartError(
        "Failed to change autostart setting. Please try again.",
      );
      setStartWithOS(!value);
      console.warn("autostart error:", err);
    }
  };

  const handlePingTarget = useCallback(
    (target: string) => {
      setLocalPingTarget(target);
      if (pingDebounceRef.current) {
        clearTimeout(pingDebounceRef.current);
      }
      const isValid = /^[a-zA-Z0-9.\-:]+$/.test(target) && target.length > 0;
      if (isValid) {
        pingDebounceRef.current = setTimeout(() => {
          setPingTarget(target);
          invoke("set_ping_target", { target }).catch(console.warn);
        }, 500);
      }
    },
    [setPingTarget],
  );

  useEffect(() => {
    return () => {
      if (pingDebounceRef.current) clearTimeout(pingDebounceRef.current);
    };
  }, []);

  const handleTheme = (index: number) => {
    setSelectedTheme(index);
    setStorageItem("fluxnet_accent_index", index);
  };

  const handleColorMode = (mode: ColorMode) => {
    setColorMode(mode);
    setStorageItem("fluxnet_color_mode", mode);
  };

  const handleResetPeaks = () => {
    resetPeaks();
    invoke("reset_peaks").catch(console.warn);
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
              <div className="settings-label">Dashboard refresh interval</div>
              <div className="settings-sub">
                How often the dashboard UI updates (backend always samples at
                500ms)
              </div>
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
              <div className="settings-sub">
                How speeds are formatted everywhere
              </div>
            </div>
            <select
              className="fn-select"
              value={displayUnits}
              onChange={(e) => handleUnits(e.target.value)}
            >
              <option value="auto">Auto (adaptive)</option>
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
              value={localPingTarget}
              onChange={(e) => handlePingTarget(e.target.value)}
              placeholder="e.g. 1.1.1.1"
              pattern="[a-zA-Z0-9.\-:]+"
              style={{ width: 160, fontFamily: "monospace" }}
            />
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Start with Windows</div>
              <div className="settings-sub">
                Launch FluxNet at login
                {autostartError && (
                  <span
                    style={{
                      display: "block",
                      color: "var(--danger, #c33)",
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    {autostartError}
                  </span>
                )}
              </div>
            </div>
            <div
              className={`toggle ${startWithOS ? "on" : "off"} ${!autostartAvailable ? "disabled" : ""}`}
              onClick={() => handleStartWithOS(!startWithOS)}
              role="switch"
              aria-checked={startWithOS}
              aria-disabled={!autostartAvailable}
              tabIndex={autostartAvailable ? 0 : -1}
              onKeyDown={(e) => {
                if (
                  autostartAvailable &&
                  (e.key === " " || e.key === "Enter")
                ) {
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
            <div
              className="theme-chips"
              role="radiogroup"
              aria-label="Accent colour"
            >
              {THEMES.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  className={`theme-chip ${selectedTheme === i ? "selected" : ""}`}
                  style={{
                    background: t.color,
                    // Add border for dark colors to make them visible
                    border:
                      selectedTheme === i
                        ? `2px solid var(--accent)`
                        : isLightColor(t.color)
                          ? `2px solid transparent`
                          : `2px solid rgba(255,255,255,0.3)`,
                  }}
                  title={t.label}
                  aria-label={`${t.label} theme`}
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
              <div className="settings-label">Reset session peaks</div>
              <div className="settings-sub">
                Clear peak upload/download for this session
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetPeaks}
              className="btn-danger"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Simple check if a hex color is "light" enough to not need a visible border */
function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Perceived brightness
  return r * 0.299 + g * 0.587 + b * 0.114 > 80;
}
