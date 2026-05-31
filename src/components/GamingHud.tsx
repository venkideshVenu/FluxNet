import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNetworkStore } from "../store/networkStore";
import { usePingStore } from "../store/pingStore";
import { usePingPoller } from "../hooks/usePingPoller";
import { formatSpeed } from "../utils/formatSpeed";

export function GamingHud() {
  // Start ping polling — only runs in this component
  usePingPoller(2000);

  const { data } = useNetworkStore();
  const { stats } = usePingStore();

  const up = formatSpeed(data.uploadBytesPerSec);
  const dn = formatSpeed(data.downloadBytesPerSec);

  const latency = stats.latencyMs < 0 ? "—" : `${Math.round(stats.latencyMs)}`;

  const loss = `${stats.lossPercent.toFixed(1)}%`;

  // Ping colour thresholds
  const pingColour =
    stats.latencyMs < 0
      ? "var(--hud-muted)"
      : stats.latencyMs < 50
        ? "var(--hud-amber)"
        : stats.latencyMs < 150
          ? "var(--hud-amber)"
          : "var(--hud-danger)";

  const handleDrag = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await getCurrentWindow().startDragging();
    } catch {}
  };

  return (
    <div className="hud-root">
      <div className="hud-card">
        {/* ── Header ── */}
        <div className="hud-header">
          <span className="hud-title">FLUXNET HUD</span>
          <button
            type="button"
            className="hud-drag-handle"
            title="Drag to move"
            aria-label="Drag HUD widget"
            onMouseDown={handleDrag}
          />
        </div>

        <div className="hud-rule" />

        {/* ── Speed rows ── */}
        <div className="hud-rows">
          <div className="hud-row">
            <span className="hud-row-label">
              <span className="hud-arrow">↓</span> DOWNLOAD
            </span>
            <span className="hud-row-value dn">
              {dn.value} <span className="hud-unit">{dn.unit}</span>
            </span>
          </div>

          <div className="hud-row">
            <span className="hud-row-label">
              <span className="hud-arrow">↑</span> UPLOAD
            </span>
            <span className="hud-row-value up">
              {up.value} <span className="hud-unit">{up.unit}</span>
            </span>
          </div>
        </div>

        <div className="hud-rule" />

        {/* ── Ping / Loss rows ── */}
        <div className="hud-rows">
          <div className="hud-row">
            <span className="hud-row-label">PING</span>
            <span className="hud-row-value" style={{ color: pingColour }}>
              {latency}{" "}
              {stats.latencyMs >= 0 && <span className="hud-unit">ms</span>}
            </span>
          </div>

          <div className="hud-row">
            <span className="hud-row-label">LOSS</span>
            <span className="hud-row-value loss">{loss}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
