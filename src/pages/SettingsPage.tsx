import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useNetworkStore, DisplayUnits } from "../store/networkStore";
import {
  THEMES,
  LS_COMPACT_MODE,
  LS_HUD_MODE,
  LS_THEME,
  LS_MODE,
  LS_PILL_MODE,
  applyAccent,
  applyColorMode,
  getStoredAccentIndex,
  getStoredColorMode,
  getStoredCompactMode,
  getStoredHudMode,
  getStoredPillMode,
  ColorMode,
} from "../utils/theme";
import {
  getStoredCompactAlwaysOnTop,
  getStoredHudAlwaysOnTop,
  getStoredPillAlwaysOnTop,
  LS_COMPACT_ALWAYS_ON_TOP,
  LS_HUD_ALWAYS_ON_TOP,
  LS_PILL_ALWAYS_ON_TOP,
} from "../utils/windowPrefs";
import {
  LS_COMPACT_INTERVAL,
  LS_HUD_INTERVAL,
  LS_PILL_INTERVAL,
  getStoredCompactIntervalMs,
  getStoredHudIntervalMs,
  getStoredPillIntervalMs,
} from "../utils/polling";

// localStorage keys
const LS_OPACITY = "fluxnet_opacity";
const LS_COMPACT_OPACITY = "fluxnet_compact_opacity";
const LS_HUD_OPACITY = "fluxnet_hud_opacity";

export function SettingsPage() {
  // ── Pill visibility (unchanged — already worked) ──────────
  const [pillVisible, setPillVisible] = useState(false);

  // ── Compact visibility ───────────────────────────────────
  const [compactVisible, setCompactVisible] = useState(false);

  // ── HUD visibility ───────────────────────────────────────
  const [hudVisible, setHudVisible] = useState(false);

  // ── Always-on-top ─────────────────────────────────────────
  const [alwaysOnTop, setAlwaysOnTop] = useState(() =>
    getStoredPillAlwaysOnTop(),
  );
  const [compactAlwaysOnTop, setCompactAlwaysOnTop] = useState(() =>
    getStoredCompactAlwaysOnTop(),
  );
  const [hudAlwaysOnTop, setHudAlwaysOnTop] = useState(() =>
    getStoredHudAlwaysOnTop(),
  );

  // ── Opacity ───────────────────────────────────────────────
  const [opacity, setOpacity] = useState(() => {
    const saved = localStorage.getItem(LS_OPACITY);
    return saved ? Number(saved) : 88;
  });
  const [compactOpacity, setCompactOpacity] = useState(() => {
    const saved = localStorage.getItem(LS_COMPACT_OPACITY);
    return saved ? Number(saved) : 88;
  });
  const [hudOpacity, setHudOpacity] = useState(() => {
    const saved = localStorage.getItem(LS_HUD_OPACITY);
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
    return getStoredAccentIndex();
  });

  // ── Light/dark mode ──────────────────────────────────────
  const [colorMode, setColorMode] = useState<ColorMode>(() =>
    getStoredColorMode(),
  );

  // ── Pill light/dark mode ─────────────────────────────────
  const [pillColorMode, setPillColorMode] = useState<ColorMode>(() =>
    getStoredPillMode(),
  );

  // ── Compact light/dark mode ───────────────────────────────
  const [compactColorMode, setCompactColorMode] = useState<ColorMode>(() =>
    getStoredCompactMode(),
  );
  const [hudColorMode, setHudColorMode] = useState<ColorMode>(() =>
    getStoredHudMode(),
  );

  const [pillIntervalMs, setPillIntervalMs] = useState(() =>
    getStoredPillIntervalMs(),
  );

  const [compactIntervalMs, setCompactIntervalMs] = useState(() =>
    getStoredCompactIntervalMs(),
  );
  const [hudIntervalMs, setHudIntervalMs] = useState(() =>
    getStoredHudIntervalMs(),
  );

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

  // ── Sync compact visibility on mount ──────────────────────
  useEffect(() => {
    (async () => {
      try {
        const compact = await WebviewWindow.getByLabel("compact");
        if (!compact) return;
        setCompactVisible(await compact.isVisible());
      } catch (err) {
        console.warn("compact window check failed:", err);
      }
    })();
  }, []);

  // ── Sync HUD visibility on mount ─────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const hud = await WebviewWindow.getByLabel("hud");
        if (!hud) return;
        setHudVisible(await hud.isVisible());
      } catch (err) {
        console.warn("hud window check failed:", err);
      }
    })();
  }, []);

  // Apply accent + color mode when they change
  useEffect(() => {
    const swatch = THEMES[selectedTheme] ?? THEMES[0];
    applyAccent(swatch.color);
  }, [selectedTheme]);

  useEffect(() => {
    applyColorMode(colorMode);
  }, [colorMode]);

  useEffect(() => {
    localStorage.setItem(LS_PILL_ALWAYS_ON_TOP, String(alwaysOnTop));
  }, [alwaysOnTop]);

  useEffect(() => {
    localStorage.setItem(LS_COMPACT_ALWAYS_ON_TOP, String(compactAlwaysOnTop));
  }, [compactAlwaysOnTop]);

  useEffect(() => {
    localStorage.setItem(LS_HUD_ALWAYS_ON_TOP, String(hudAlwaysOnTop));
  }, [hudAlwaysOnTop]);

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

  const toggleCompact = async () => {
    try {
      const compact = await WebviewWindow.getByLabel("compact");
      if (!compact) return;
      if (compactVisible) await compact.hide();
      else await compact.show();
      setCompactVisible((v) => !v);
    } catch (err) {
      console.error("compact toggle failed:", err);
    }
  };

  const toggleHud = async () => {
    try {
      const hud = await WebviewWindow.getByLabel("hud");
      if (!hud) return;
      if (hudVisible) await hud.hide();
      else await hud.show();
      setHudVisible((v) => !v);
    } catch (err) {
      console.error("hud toggle failed:", err);
    }
  };

  const handleAlwaysOnTop = async (value: boolean) => {
    setAlwaysOnTop(value);
    localStorage.setItem(LS_PILL_ALWAYS_ON_TOP, String(value));
    try {
      await invoke("set_pill_always_on_top", { value });
    } catch (err) {
      console.error("set_always_on_top failed:", err);
    }
  };

  const handleCompactAlwaysOnTop = async (value: boolean) => {
    setCompactAlwaysOnTop(value);
    localStorage.setItem(LS_COMPACT_ALWAYS_ON_TOP, String(value));
    try {
      await invoke("set_compact_always_on_top", { value });
    } catch (err) {
      console.error("set_compact_always_on_top failed:", err);
    }
  };

  const handleHudAlwaysOnTop = async (value: boolean) => {
    setHudAlwaysOnTop(value);
    localStorage.setItem(LS_HUD_ALWAYS_ON_TOP, String(value));
    try {
      await invoke("set_hud_always_on_top", { value });
    } catch (err) {
      console.error("set_hud_always_on_top failed:", err);
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

  const handleCompactOpacityCommit = async (value: number) => {
    localStorage.setItem(LS_COMPACT_OPACITY, String(value));
    try {
      await invoke("set_compact_opacity", { value: value / 100 });
    } catch (err) {
      console.error("set_compact_opacity failed:", err);
    }
  };

  const handleHudOpacityCommit = async (value: number) => {
    localStorage.setItem(LS_HUD_OPACITY, String(value));
    try {
      await invoke("set_hud_opacity", { value: value / 100 });
    } catch (err) {
      console.error("set_hud_opacity failed:", err);
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
  };

  const handleColorMode = (mode: ColorMode) => {
    setColorMode(mode);
    localStorage.setItem(LS_MODE, mode);
  };

  const handlePillColorMode = (mode: ColorMode) => {
    setPillColorMode(mode);
    localStorage.setItem(LS_PILL_MODE, mode);
  };

  const handleCompactColorMode = (mode: ColorMode) => {
    setCompactColorMode(mode);
    localStorage.setItem(LS_COMPACT_MODE, mode);
  };

  const handleHudColorMode = (mode: ColorMode) => {
    setHudColorMode(mode);
    localStorage.setItem(LS_HUD_MODE, mode);
  };

  const handlePillInterval = (raw: string) => {
    const secs = parseFloat(raw);
    const next = secs * 1000;
    setPillIntervalMs(next);
    localStorage.setItem(LS_PILL_INTERVAL, String(next));
  };

  const handleCompactInterval = (raw: string) => {
    const secs = parseFloat(raw);
    const next = secs * 1000;
    setCompactIntervalMs(next);
    localStorage.setItem(LS_COMPACT_INTERVAL, String(next));
  };

  const handleHudInterval = (raw: string) => {
    const secs = parseFloat(raw);
    const next = secs * 1000;
    setHudIntervalMs(next);
    localStorage.setItem(LS_HUD_INTERVAL, String(next));
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
              <div className="settings-label">Pill dark mode</div>
              <div className="settings-sub">
                Use a dark theme for the pill widget
              </div>
            </div>
            <div
              className={`toggle ${pillColorMode === "dark" ? "on" : "off"}`}
              onClick={() =>
                handlePillColorMode(pillColorMode === "dark" ? "light" : "dark")
              }
              role="switch"
              aria-checked={pillColorMode === "dark"}
            >
              <div className="toggle-thumb" />
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Widget refresh interval</div>
              <div className="settings-sub">
                How often the pill widget updates
              </div>
            </div>
            <select
              className="fn-select"
              value={String(pillIntervalMs / 1000)}
              onChange={(e) => handlePillInterval(e.target.value)}
            >
              <option value="0.5">0.5 seconds</option>
              <option value="1">1 second</option>
              <option value="2">2 seconds</option>
              <option value="5">5 seconds</option>
            </select>
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

      {/* HUD widget section */}
      <div className="settings-section">
        <div className="settings-section-title">HUD Widget</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">HUD widget</div>
              <div className="settings-sub">Show or hide the HUD widget</div>
            </div>
            <div
              className={`toggle ${hudVisible ? "on" : "off"}`}
              onClick={toggleHud}
              role="switch"
              aria-checked={hudVisible}
            >
              <div className="toggle-thumb" />
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Always on top</div>
              <div className="settings-sub">
                Float the HUD widget above all windows
              </div>
            </div>
            <div
              className={`toggle ${hudAlwaysOnTop ? "on" : "off"}`}
              onClick={() => handleHudAlwaysOnTop(!hudAlwaysOnTop)}
              role="switch"
              aria-checked={hudAlwaysOnTop}
            >
              <div className="toggle-thumb" />
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">HUD dark mode</div>
              <div className="settings-sub">
                Use a dark theme for the HUD widget
              </div>
            </div>
            <div
              className={`toggle ${hudColorMode === "dark" ? "on" : "off"}`}
              onClick={() =>
                handleHudColorMode(hudColorMode === "dark" ? "light" : "dark")
              }
              role="switch"
              aria-checked={hudColorMode === "dark"}
            >
              <div className="toggle-thumb" />
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Widget refresh interval</div>
              <div className="settings-sub">
                How often the HUD widget updates
              </div>
            </div>
            <select
              className="fn-select"
              value={String(hudIntervalMs / 1000)}
              onChange={(e) => handleHudInterval(e.target.value)}
            >
              <option value="0.5">0.5 seconds</option>
              <option value="1">1 second</option>
              <option value="2">2 seconds</option>
              <option value="5">5 seconds</option>
            </select>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Widget opacity</div>
              <div className="settings-sub">{hudOpacity}%</div>
            </div>
            <input
              type="range"
              className="fn-slider"
              min={40}
              max={100}
              value={hudOpacity}
              onChange={(e) => setHudOpacity(Number(e.target.value))}
              onMouseUp={(e) =>
                handleHudOpacityCommit(
                  Number((e.target as HTMLInputElement).value),
                )
              }
              onTouchEnd={(e) =>
                handleHudOpacityCommit(
                  Number((e.target as HTMLInputElement).value),
                )
              }
            />
          </div>
        </div>
      </div>

      {/* Compact widget section */}
      <div className="settings-section">
        <div className="settings-section-title">Compact Widget</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Compact widget</div>
              <div className="settings-sub">
                Show or hide the compact widget
              </div>
            </div>
            <div
              className={`toggle ${compactVisible ? "on" : "off"}`}
              onClick={toggleCompact}
              role="switch"
              aria-checked={compactVisible}
            >
              <div className="toggle-thumb" />
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Always on top</div>
              <div className="settings-sub">
                Float the compact widget above all windows
              </div>
            </div>
            <div
              className={`toggle ${compactAlwaysOnTop ? "on" : "off"}`}
              onClick={() => handleCompactAlwaysOnTop(!compactAlwaysOnTop)}
              role="switch"
              aria-checked={compactAlwaysOnTop}
            >
              <div className="toggle-thumb" />
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Compact dark mode</div>
              <div className="settings-sub">
                Use a dark theme for the compact widget
              </div>
            </div>
            <div
              className={`toggle ${compactColorMode === "dark" ? "on" : "off"}`}
              onClick={() =>
                handleCompactColorMode(
                  compactColorMode === "dark" ? "light" : "dark",
                )
              }
              role="switch"
              aria-checked={compactColorMode === "dark"}
            >
              <div className="toggle-thumb" />
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Widget refresh interval</div>
              <div className="settings-sub">
                How often the compact widget updates
              </div>
            </div>
            <select
              className="fn-select"
              value={String(compactIntervalMs / 1000)}
              onChange={(e) => handleCompactInterval(e.target.value)}
            >
              <option value="0.5">0.5 seconds</option>
              <option value="1">1 second</option>
              <option value="2">2 seconds</option>
              <option value="5">5 seconds</option>
            </select>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Widget opacity</div>
              <div className="settings-sub">{compactOpacity}%</div>
            </div>
            <input
              type="range"
              className="fn-slider"
              min={40}
              max={100}
              value={compactOpacity}
              onChange={(e) => setCompactOpacity(Number(e.target.value))}
              onMouseUp={(e) =>
                handleCompactOpacityCommit(
                  Number((e.target as HTMLInputElement).value),
                )
              }
              onTouchEnd={(e) =>
                handleCompactOpacityCommit(
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
