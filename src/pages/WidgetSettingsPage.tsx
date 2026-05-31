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

// ─── Pill Preview ──────────────────────────────────────────────────────────────
function PillPreview({
  colorMode,
  opacity,
}: {
  colorMode: ColorMode;
  opacity: number;
}) {
  const isDark = colorMode === "dark";

  const styles = {
    wrapper: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      padding: "24px",
    } as React.CSSProperties,
    pill: {
      display: "inline-flex",
      alignItems: "center",
      background: isDark ? "rgba(18,16,32,0.94)" : "rgba(252,252,255,0.98)",
      border: `1px solid ${isDark ? "rgba(124,111,247,0.14)" : "rgba(79,66,192,0.45)"}`,
      color: isDark ? "#e9e8f4" : "#1a1830",
      borderRadius: "999px",
      padding: "5px 10px",
      gap: "7px",
      backdropFilter: "blur(18px)",
      opacity: opacity / 100,
      fontFamily: '"JetBrains Mono", monospace',
      boxShadow: isDark
        ? "0 4px 24px rgba(0,0,0,0.4)"
        : "0 4px 24px rgba(0,0,0,0.12)",
    } as React.CSSProperties,
    stat: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      width: "66px",
      flexShrink: 0,
    } as React.CSSProperties,
    value: (isDownload: boolean) =>
      ({
        fontSize: "12px",
        fontWeight: 700,
        fontFamily: '"JetBrains Mono", monospace',
        letterSpacing: "-0.03em",
        width: "34px",
        textAlign: "right",
        color: isDownload ? "#22d97d" : "#7c6ff7",
        fontVariantNumeric: "tabular-nums",
      }) as React.CSSProperties,
    unit: {
      fontSize: "7px",
      fontWeight: 700,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "30px",
      minWidth: "30px",
      height: "15px",
      borderRadius: "5px",
      letterSpacing: "0.05em",
      color: isDark ? "#ff9f4a" : "#8a4a0a",
      background: isDark ? "rgba(90,54,18,0.45)" : "rgba(255,159,74,0.2)",
      border: `1px solid ${isDark ? "rgba(255,159,74,0.55)" : "rgba(138,74,10,0.35)"}`,
    } as React.CSSProperties,
    sep: {
      width: "1px",
      height: "13px",
      background: isDark ? "rgba(124,111,247,0.12)" : "rgba(79,66,192,0.35)",
      margin: "0 1px",
    } as React.CSSProperties,
    dot: {
      width: "7px",
      height: "7px",
      marginLeft: "2px",
      borderRadius: "50%",
      background: "#22d97d",
      boxShadow: "0 0 6px rgba(34,217,125,0.7), 0 0 10px rgba(34,217,125,0.2)",
    } as React.CSSProperties,
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.pill}>
        <div style={styles.stat}>
          <span style={styles.value(true)}>24.5</span>
          <span style={styles.unit}>MB/s</span>
        </div>
        <div style={styles.sep} />
        <div style={styles.stat}>
          <span style={styles.value(false)}>3.2</span>
          <span style={styles.unit}>MB/s</span>
        </div>
        <div style={styles.dot} />
      </div>
    </div>
  );
}

// ─── Compact Preview ───────────────────────────────────────────────────────────
function CompactPreview({
  colorMode,
  opacity,
  intervalMs,
}: {
  colorMode: ColorMode;
  opacity: number;
  intervalMs: number;
}) {
  const isDark = colorMode === "dark";
  const bg = isDark ? "rgba(18,16,32,0.94)" : "rgba(255,255,255,0.96)";
  const border = isDark ? "#2a2650" : "rgba(24,33,61,0.1)";
  const textPrimary = isDark ? "#eae9ff" : "#18213d";
  const textMuted = isDark ? "#5b5890" : "#6d7897";
  const textBrand = isDark ? "#9995cc" : "#667394";
  const divider = isDark ? "#242046" : "rgba(24,33,61,0.08)";
  const pillBg = isDark ? "#1e1c3a" : "rgba(72,99,255,0.08)";
  const pillColor = isDark ? "#b0aaff" : "#32437a";
  const upColor = "#22c97a";
  const dnColor = "#7c6ff7";

  const card: React.CSSProperties = {
    width: "180px",
    background: bg,
    borderRadius: "12px",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    border: `1px solid ${border}`,
    fontFamily: '"JetBrains Mono", monospace',
    opacity: opacity / 100,
    boxShadow: isDark
      ? "0 8px 32px rgba(0,0,0,0.5)"
      : "0 8px 24px rgba(15,23,42,0.1)",
    fontSize: "8px",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", padding: "24px" }}>
      <div style={card}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "7px" }}>
          <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: textBrand }}>
            FluxNet
          </span>
          <div style={{ width: "22px", height: "15px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "12px", height: "2px", borderRadius: "2px", background: textMuted }} />
          </div>
        </div>

        {/* Status row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginBottom: "6px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "8px", fontWeight: 600, letterSpacing: "0.11em", textTransform: "uppercase", color: textPrimary }}>
              en0
            </span>
            <span style={{ fontSize: "8px", color: textMuted }}>Connected</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "8px", fontWeight: 600, color: pillColor, background: pillBg, borderRadius: "99px", padding: "2px 6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: upColor, boxShadow: "0 0 4px rgba(34,201,122,0.5)" }} />
              Live
            </span>
            <span style={{ fontSize: "8px", color: textMuted }}>{intervalMs / 1000}s</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: divider, margin: "5px 0 6px" }} />

        {/* Speeds */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "8px", fontWeight: 600, letterSpacing: "0.11em", textTransform: "uppercase", color: textMuted }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: dnColor, display: "inline-block" }} />
              Download
            </span>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: "4px" }}>
              <span style={{ fontSize: "15px", fontWeight: 500, color: textPrimary, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>24.5</span>
              <span style={{ fontSize: "9px", color: textMuted }}>MB/s</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "8px", fontWeight: 600, letterSpacing: "0.11em", textTransform: "uppercase", color: textMuted }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: upColor, display: "inline-block" }} />
              Upload
            </span>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: "4px" }}>
              <span style={{ fontSize: "15px", fontWeight: 500, color: textPrimary, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>3.2</span>
              <span style={{ fontSize: "9px", color: textMuted }}>MB/s</span>
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: divider, margin: "5px 0 6px" }} />

        {/* Today */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "8px", letterSpacing: "0.11em", textTransform: "uppercase", color: textMuted }}>Today</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: "4px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: dnColor, display: "inline-block", alignSelf: "center" }} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: textPrimary, fontVariantNumeric: "tabular-nums" }}>12.3</span>
              <span style={{ fontSize: "9px", color: textMuted }}>GB</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: "4px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: upColor, display: "inline-block", alignSelf: "center" }} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: textPrimary, fontVariantNumeric: "tabular-nums" }}>2.1</span>
              <span style={{ fontSize: "9px", color: textMuted }}>GB</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── HUD Preview ───────────────────────────────────────────────────────────────
function HudPreview({
  colorMode,
  opacity,
}: {
  colorMode: ColorMode;
  opacity: number;
}) {
  const isDark = colorMode === "dark";

  const card: React.CSSProperties = {
    width: "200px",
    background: isDark ? "#13111f" : "rgba(255,255,255,0.96)",
    border: `1px solid ${isDark ? "rgba(90,80,180,0.35)" : "rgba(24,33,61,0.1)"}`,
    borderRadius: "12px",
    display: "grid",
    gridTemplateRows: "auto 1px 1fr 1px 1fr",
    overflow: "hidden",
    fontFamily: '"JetBrains Mono", monospace',
    opacity: opacity / 100,
    boxShadow: isDark
      ? "0 12px 40px rgba(0,0,0,0.6)"
      : "0 10px 30px rgba(15,23,42,0.1), 0 3px 10px rgba(15,23,42,0.05)",
  };

  const rule: React.CSSProperties = {
    height: "1px",
    background: isDark ? "rgba(90,80,180,0.18)" : "rgba(24,33,61,0.08)",
    flexShrink: 0,
  };

  const labelColor = isDark ? "rgba(214,211,255,0.85)" : "#51607f";
  const upColor = "#22c97a";
  const dnColor = "#7c6ff7";
  const brand = isDark ? "rgba(235,234,255,0.9)" : "#18213d";
  const muted = isDark ? "rgba(234,233,255,0.6)" : "#7a86a5";
  const neutral = isDark ? "#fff" : "#18213d";
  const amber = isDark ? "#f59e0b" : "#c97d00";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", padding: "24px" }}>
      <div style={card}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px" }}>
          <span style={{ fontSize: "8px", fontWeight: 600, letterSpacing: "0.15em", color: brand, textTransform: "uppercase" }}>
            FLUXNET HUD
          </span>
          <div style={{ width: "12px", height: "2px", borderRadius: "2px", background: brand, opacity: 0.5 }} />
        </div>

        <div style={rule} />

        {/* Speed rows */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {[
            { arrow: "↓", label: "DOWNLOAD", value: "24.5", unit: "MB/s", color: dnColor },
            { arrow: "↑", label: "UPLOAD", value: "3.2", unit: "MB/s", color: upColor },
          ].map((row) => (
            <div key={row.label} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", columnGap: "8px", padding: "4px 10px", flex: "1 1 0" }}>
              <span style={{ fontSize: "7px", fontWeight: 600, letterSpacing: "0.11em", textTransform: "uppercase", color: labelColor, display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ opacity: 0.7 }}>{row.arrow}</span> {row.label}
              </span>
              <span style={{ fontSize: "14px", fontWeight: 500, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.005em", lineHeight: 1, display: "flex", alignItems: "baseline", gap: "2px", color: row.color, justifyContent: "flex-end" }}>
                {row.value} <span style={{ fontSize: "9px", color: muted, fontWeight: 400 }}>{row.unit}</span>
              </span>
            </div>
          ))}
        </div>

        <div style={rule} />

        {/* Ping/Loss rows */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", columnGap: "8px", padding: "4px 10px", flex: "1 1 0" }}>
            <span style={{ fontSize: "7px", fontWeight: 600, letterSpacing: "0.11em", textTransform: "uppercase", color: labelColor }}>PING</span>
            <span style={{ fontSize: "14px", fontWeight: 500, fontVariantNumeric: "tabular-nums", color: amber, display: "flex", alignItems: "baseline", gap: "2px" }}>
              42 <span style={{ fontSize: "9px", color: muted, fontWeight: 400 }}>ms</span>
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", columnGap: "8px", padding: "4px 10px", flex: "1 1 0" }}>
            <span style={{ fontSize: "7px", fontWeight: 600, letterSpacing: "0.11em", textTransform: "uppercase", color: labelColor }}>LOSS</span>
            <span style={{ fontSize: "14px", fontWeight: 500, fontVariantNumeric: "tabular-nums", color: neutral }}>0.0%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Toggle ────────────────────────────────────────────────────────────────────
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

// ─── Settings Row ──────────────────────────────────────────────────────────────
function SettingsRow({ children }: { children: React.ReactNode }) {
  return <div className="settings-row">{children}</div>;
}

// ─── Widget Section ────────────────────────────────────────────────────────────
function WidgetSection({
  title,
  accentColor,
  previewBg,
  preview,
  settings,
  isVisible,
  onToggleVisible,
}: {
  title: string;
  accentColor: string;
  previewBg: string;
  preview: React.ReactNode;
  settings: React.ReactNode;
  isVisible: boolean;
  onToggleVisible: () => void;
}) {
  return (
    <div className="widget-section">
      <div
        className="settings-section-title"
        style={{ color: accentColor }}
      >
        {title}
      </div>

      <div className="widget-section-body">
        {/* Left: Settings Panel */}
        <div className="widget-settings-panel">
          <div className="settings-card" style={{ borderTop: `2px solid ${accentColor}22` }}>
            {settings}
          </div>

          {/* Visibility / Apply button at bottom */}
          <button
            className={`visibility-btn ${isVisible ? "visible" : "hidden"}`}
            onClick={onToggleVisible}
            style={{
              background: isVisible ? `${accentColor}18` : "transparent",
              borderColor: isVisible ? accentColor : "var(--border)",
              color: isVisible ? accentColor : "var(--text-muted)",
            }}
          >
            <span className="visibility-btn-dot" style={{ background: isVisible ? accentColor : "var(--text-muted)" }} />
            {isVisible ? "Widget Visible — Click to Hide" : "Widget Hidden — Click to Show"}
          </button>
        </div>

        {/* Right: Live Preview */}
        <div className="widget-preview-panel" style={{ background: previewBg }}>
          <div className="preview-label">Live Preview</div>
          <div className="preview-content">{preview}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function WidgetSettingsPage() {
  const [pillVisible, setPillVisible] = useState(false);
  const [compactVisible, setCompactVisible] = useState(false);
  const [hudVisible, setHudVisible] = useState(false);

  const [pillAlwaysOnTop, setPillAlwaysOnTop] = useState(() => getStoredPillAlwaysOnTop());
  const [compactAlwaysOnTop, setCompactAlwaysOnTop] = useState(() => getStoredCompactAlwaysOnTop());
  const [hudAlwaysOnTop, setHudAlwaysOnTop] = useState(() => getStoredHudAlwaysOnTop());

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

  const [pillColorMode, setPillColorMode] = useState<ColorMode>(() => getStoredPillMode());
  const [compactColorMode, setCompactColorMode] = useState<ColorMode>(() => getStoredCompactMode());
  const [hudColorMode, setHudColorMode] = useState<ColorMode>(() => getStoredHudMode());

  const [pillIntervalMs, setPillIntervalMs] = useState(() => getStoredPillIntervalMs());
  const [compactIntervalMs, setCompactIntervalMs] = useState(() => getStoredCompactIntervalMs());
  const [hudIntervalMs, setHudIntervalMs] = useState(() => getStoredHudIntervalMs());

  useEffect(() => {
    (async () => {
      try {
        const pill = await WebviewWindow.getByLabel("pill");
        if (pill) setPillVisible(await pill.isVisible());
        const compact = await WebviewWindow.getByLabel("compact");
        if (compact) setCompactVisible(await compact.isVisible());
        const hud = await WebviewWindow.getByLabel("hud");
        if (hud) setHudVisible(await hud.isVisible());
      } catch (err) {
        console.warn("window check failed:", err);
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
    try { await invoke("set_pill_always_on_top", { value }); } catch { /* noop */ }
  };

  const handleCompactAlwaysOnTop = async (value: boolean) => {
    setCompactAlwaysOnTop(value);
    localStorage.setItem(LS_COMPACT_ALWAYS_ON_TOP, String(value));
    try { await invoke("set_compact_always_on_top", { value }); } catch { /* noop */ }
  };

  const handleHudAlwaysOnTop = async (value: boolean) => {
    setHudAlwaysOnTop(value);
    localStorage.setItem(LS_HUD_ALWAYS_ON_TOP, String(value));
    try { await invoke("set_hud_always_on_top", { value }); } catch { /* noop */ }
  };

  const handlePillOpacityCommit = async (value: number) => {
    localStorage.setItem(LS_OPACITY, String(value));
    try { await invoke("set_pill_opacity", { value: value / 100 }); } catch { /* noop */ }
  };

  const handleCompactOpacityCommit = async (value: number) => {
    localStorage.setItem(LS_COMPACT_OPACITY, String(value));
    try { await invoke("set_compact_opacity", { value: value / 100 }); } catch { /* noop */ }
  };

  const handleHudOpacityCommit = async (value: number) => {
    localStorage.setItem(LS_HUD_OPACITY, String(value));
    try { await invoke("set_hud_opacity", { value: value / 100 }); } catch { /* noop */ }
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
    const next = parseFloat(raw) * 1000;
    setPillIntervalMs(next);
    localStorage.setItem(LS_PILL_INTERVAL, String(next));
  };

  const handleCompactInterval = (raw: string) => {
    const next = parseFloat(raw) * 1000;
    setCompactIntervalMs(next);
    localStorage.setItem(LS_COMPACT_INTERVAL, String(next));
  };

  const handleHudInterval = (raw: string) => {
    const next = parseFloat(raw) * 1000;
    setHudIntervalMs(next);
    localStorage.setItem(LS_HUD_INTERVAL, String(next));
  };

  const intervalOptions = [
    { value: "0.5", label: "0.5 seconds" },
    { value: "1", label: "1 second" },
    { value: "2", label: "2 seconds" },
    { value: "5", label: "5 seconds" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Widget Settings</div>
          <div className="page-subtitle">
            Configure Pill, Compact, and HUD widget behavior — preview updates live
          </div>
        </div>
      </div>

      {/* ── PILL WIDGET ── */}
      <WidgetSection
        title="Pill Widget"
        accentColor="#f59e0b"
        previewBg="linear-gradient(135deg, #0f0d1a 0%, #1a1530 100%)"
        isVisible={pillVisible}
        onToggleVisible={togglePill}
        preview={
          <PillPreview colorMode={pillColorMode} opacity={pillOpacity} />
        }
        settings={
          <>
            <SettingsRow>
              <div>
                <div className="settings-label">Always on top</div>
                <div className="settings-sub">Float the pill widget above all windows</div>
              </div>
              <Toggle checked={pillAlwaysOnTop} onChange={() => handlePillAlwaysOnTop(!pillAlwaysOnTop)} />
            </SettingsRow>

            <SettingsRow>
              <div>
                <div className="settings-label">Dark mode</div>
                <div className="settings-sub">Use a dark theme for the pill widget</div>
              </div>
              <Toggle
                checked={pillColorMode === "dark"}
                onChange={() => handlePillColorMode(pillColorMode === "dark" ? "light" : "dark")}
              />
            </SettingsRow>

            <SettingsRow>
              <div>
                <div className="settings-label">Refresh interval</div>
                <div className="settings-sub">How often the pill widget updates</div>
              </div>
              <select
                className="fn-select"
                value={String(pillIntervalMs / 1000)}
                onChange={(e) => handlePillInterval(e.target.value)}
              >
                {intervalOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </SettingsRow>

            <SettingsRow>
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
                onMouseUp={(e) => handlePillOpacityCommit(Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => handlePillOpacityCommit(Number((e.target as HTMLInputElement).value))}
              />
            </SettingsRow>
          </>
        }
      />

      {/* ── HUD WIDGET ── */}
      <WidgetSection
        title="HUD Widget"
        accentColor="#7c6ff7"
        previewBg="linear-gradient(135deg, #0c0b18 0%, #16142a 100%)"
        isVisible={hudVisible}
        onToggleVisible={toggleHud}
        preview={
          <HudPreview colorMode={hudColorMode} opacity={hudOpacity} />
        }
        settings={
          <>
            <SettingsRow>
              <div>
                <div className="settings-label">Always on top</div>
                <div className="settings-sub">Float the HUD widget above all windows</div>
              </div>
              <Toggle checked={hudAlwaysOnTop} onChange={() => handleHudAlwaysOnTop(!hudAlwaysOnTop)} />
            </SettingsRow>

            <SettingsRow>
              <div>
                <div className="settings-label">Dark mode</div>
                <div className="settings-sub">Use a dark theme for the HUD widget</div>
              </div>
              <Toggle
                checked={hudColorMode === "dark"}
                onChange={() => handleHudColorMode(hudColorMode === "dark" ? "light" : "dark")}
              />
            </SettingsRow>

            <SettingsRow>
              <div>
                <div className="settings-label">Refresh interval</div>
                <div className="settings-sub">How often the HUD widget updates</div>
              </div>
              <select
                className="fn-select"
                value={String(hudIntervalMs / 1000)}
                onChange={(e) => handleHudInterval(e.target.value)}
              >
                {intervalOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </SettingsRow>

            <SettingsRow>
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
                onMouseUp={(e) => handleHudOpacityCommit(Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => handleHudOpacityCommit(Number((e.target as HTMLInputElement).value))}
              />
            </SettingsRow>
          </>
        }
      />

      {/* ── COMPACT WIDGET ── */}
      <WidgetSection
        title="Compact Widget"
        accentColor="#22c97a"
        previewBg="linear-gradient(135deg, #0d1a14 0%, #111f18 100%)"
        isVisible={compactVisible}
        onToggleVisible={toggleCompact}
        preview={
          <CompactPreview
            colorMode={compactColorMode}
            opacity={compactOpacity}
            intervalMs={compactIntervalMs}
          />
        }
        settings={
          <>
            <SettingsRow>
              <div>
                <div className="settings-label">Always on top</div>
                <div className="settings-sub">Float the compact widget above all windows</div>
              </div>
              <Toggle checked={compactAlwaysOnTop} onChange={() => handleCompactAlwaysOnTop(!compactAlwaysOnTop)} />
            </SettingsRow>

            <SettingsRow>
              <div>
                <div className="settings-label">Dark mode</div>
                <div className="settings-sub">Use a dark theme for the compact widget</div>
              </div>
              <Toggle
                checked={compactColorMode === "dark"}
                onChange={() => handleCompactColorMode(compactColorMode === "dark" ? "light" : "dark")}
              />
            </SettingsRow>

            <SettingsRow>
              <div>
                <div className="settings-label">Refresh interval</div>
                <div className="settings-sub">How often the compact widget updates</div>
              </div>
              <select
                className="fn-select"
                value={String(compactIntervalMs / 1000)}
                onChange={(e) => handleCompactInterval(e.target.value)}
              >
                {intervalOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </SettingsRow>

            <SettingsRow>
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
                onMouseUp={(e) => handleCompactOpacityCommit(Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => handleCompactOpacityCommit(Number((e.target as HTMLInputElement).value))}
              />
            </SettingsRow>
          </>
        }
      />
    </div>
  );
}