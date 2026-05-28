import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const THEMES = [
  { color: "#7C6FF7", label: "Violet" },
  { color: "#22C97A", label: "Mint" },
  { color: "#4FBBF7", label: "Sky" },
  { color: "#F59E0B", label: "Amber" },
  { color: "#EF4444", label: "Coral" },
  { color: "#1A1830", label: "Midnight" },
];

export function SettingsPage() {
  const [alwaysOnTop,  setAlwaysOnTop]  = useState(true);
  const [startWithOS,  setStartWithOS]  = useState(false);
  const [interval,     setInterval]     = useState("1");
  const [units,        setUnits]        = useState("MB/s");
  const [selectedTheme,setSelectedTheme]= useState(0);
  const [opacity,      setOpacity]      = useState(88);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Customize FluxNet behaviour and appearance</div>
        </div>
      </div>

      {/* Widget section */}
      <div className="settings-section">
        <div className="settings-section-title">Widget</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Always on top</div>
              <div className="settings-sub">Float the pill widget above all windows</div>
            </div>
            <div
              className={`toggle ${alwaysOnTop ? "on" : "off"}`}
              onClick={() => setAlwaysOnTop((v) => !v)}
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
              min={40} max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
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
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
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
              value={units}
              onChange={(e) => setUnits(e.target.value)}
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
              onClick={() => setStartWithOS((v) => !v)}
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
          <div className="settings-row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 12 }}>
            <div className="settings-label">Accent colour</div>
            <div className="theme-chips">
              {THEMES.map((t, i) => (
                <div
                  key={i}
                  className={`theme-chip ${selectedTheme === i ? "selected" : ""}`}
                  style={{ background: t.color }}
                  title={t.label}
                  onClick={() => setSelectedTheme(i)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="settings-section">
        <div className="settings-section-title">Data</div>
        <div className="settings-card">
          <div className="settings-row">
            <div>
              <div className="settings-label">Reset peak values</div>
              <div className="settings-sub">Clear session peak upload and download</div>
            </div>
            <button
              onClick={() => invoke("reset_peaks")}
              style={{
                background: "#FFF0F0", color: "#DC2626",
                border: "1px solid #FECACA", borderRadius: 7,
                padding: "5px 12px", fontSize: 12,
                cursor: "pointer", fontFamily: "inherit",
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