import { memo } from "react";

export interface HudPresentationProps {
  downloadValue: string;
  downloadUnit: string;
  uploadValue: string;
  uploadUnit: string;
  /** Ping latency in ms. `null` means no data / timeout. */
  latencyMs: number | null;
  lossPercent: number;
}

export const HudPresentation = memo(function HudPresentation({
  downloadValue,
  downloadUnit,
  uploadValue,
  uploadUnit,
  latencyMs,
  lossPercent,
}: HudPresentationProps) {
  const latencyText = latencyMs === null ? "—" : `${Math.round(latencyMs)}`;
  const lossText = `${lossPercent.toFixed(1)}%`;

  const pingColour =
    latencyMs === null
      ? "var(--hud-muted)"
      : latencyMs < 50
        ? "var(--hud-good)"
        : latencyMs < 150
          ? "var(--hud-amber)"
          : "var(--hud-danger)";

  return (
    <div className="hud-root">
      <div className="hud-card">
        <div className="hud-header">
          <span className="hud-title">FLUXNET HUD</span>
          <button
            type="button"
            className="hud-drag-handle"
            title="Drag to move"
            aria-label="Drag HUD widget"
          />
        </div>
        <div className="hud-rule" />
        <div className="hud-rows">
          <div className="hud-row">
            <span className="hud-row-label">
              <span className="hud-arrow">↓</span> DOWNLOAD
            </span>
            <span className="hud-row-value dn">
              {downloadValue} <span className="hud-unit">{downloadUnit}</span>
            </span>
          </div>
          <div className="hud-row">
            <span className="hud-row-label">
              <span className="hud-arrow">↑</span> UPLOAD
            </span>
            <span className="hud-row-value up">
              {uploadValue} <span className="hud-unit">{uploadUnit}</span>
            </span>
          </div>
        </div>
        <div className="hud-rule" />
        <div className="hud-rows">
          <div className="hud-row">
            <span className="hud-row-label">PING</span>
            <span className="hud-row-value" style={{ color: pingColour }}>
              {latencyText}
              {latencyMs !== null && <span className="hud-unit">ms</span>}
            </span>
          </div>
          <div className="hud-row">
            <span className="hud-row-label">LOSS</span>
            <span className="hud-row-value loss">{lossText}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
