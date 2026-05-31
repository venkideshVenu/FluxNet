import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  LS_COMPACT_MODE,
  LS_HUD_MODE,
  LS_PILL_MODE,
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

const LS_OPACITY = "fluxnet_opacity";
const LS_COMPACT_OPACITY = "fluxnet_compact_opacity";
const LS_HUD_OPACITY = "fluxnet_hud_opacity";

export function WidgetSettingsPage() {
  const [pillVisible, setPillVisible] = useState(false);
  const [compactVisible, setCompactVisible] = useState(false);
  const [hudVisible, setHudVisible] = useState(false);

  const [pillAlwaysOnTop, setPillAlwaysOnTop] = useState(() =>
    getStoredPillAlwaysOnTop(),
  );
  const [compactAlwaysOnTop, setCompactAlwaysOnTop] = useState(() =>
    getStoredCompactAlwaysOnTop(),
  );
  const [hudAlwaysOnTop, setHudAlwaysOnTop] = useState(() =>
    getStoredHudAlwaysOnTop(),
  );

  const [pillOpacity, setPillOpacity] = useState(() => {
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

  const [pillColorMode, setPillColorMode] = useState<ColorMode>(() =>
    getStoredPillMode(),
  );
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

  const handlePillAlwaysOnTop = async (value: boolean) => {
    setPillAlwaysOnTop(value);
    localStorage.setItem(LS_PILL_ALWAYS_ON_TOP, String(value));
    try {
      await invoke("set_pill_always_on_top", { value });
    } catch (err) {
      console.error("set_pill_always_on_top failed:", err);
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

  const handlePillOpacityCommit = async (value: number) => {
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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Widget Settings</div>
          <div className="page-subtitle">
            Configure Pill, Compact, and HUD widget behavior
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Pill Widget</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Visibility</div>
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
              className={`toggle ${pillAlwaysOnTop ? "on" : "off"}`}
              onClick={() => handlePillAlwaysOnTop(!pillAlwaysOnTop)}
              role="switch"
              aria-checked={pillAlwaysOnTop}
            >
              <div className="toggle-thumb" />
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Dark mode</div>
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
              <div className="settings-label">Refresh interval</div>
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
              <div className="settings-label">Opacity</div>
              <div className="settings-sub">{pillOpacity}%</div>
            </div>
            <input
              type="range"
              className="fn-slider"
              min={40}
              max={100}
              value={pillOpacity}
              onChange={(e) => setPillOpacity(Number(e.target.value))}
              onMouseUp={(e) =>
                handlePillOpacityCommit(
                  Number((e.target as HTMLInputElement).value),
                )
              }
              onTouchEnd={(e) =>
                handlePillOpacityCommit(
                  Number((e.target as HTMLInputElement).value),
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">HUD Widget</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Visibility</div>
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
              <div className="settings-label">Dark mode</div>
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
              <div className="settings-label">Refresh interval</div>
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
              <div className="settings-label">Opacity</div>
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

      <div className="settings-section">
        <div className="settings-section-title">Compact Widget</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Visibility</div>
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
              <div className="settings-label">Dark mode</div>
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
              <div className="settings-label">Refresh interval</div>
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
              <div className="settings-label">Opacity</div>
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
    </div>
  );
}
