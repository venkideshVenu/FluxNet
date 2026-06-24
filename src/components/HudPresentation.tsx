import { memo } from "react";

export interface HudPresentationProps {
  downloadValue: string;
  downloadUnit: string;
  uploadValue: string;
  uploadUnit: string;
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
  const latencyText =
    latencyMs === null ? "—" : `${Math.round(latencyMs)}ms`;

  const lossText = `${lossPercent.toFixed(0)}%`;

  const pingColour =
    latencyMs === null
      ? "var(--hud-muted)"
      : latencyMs < 50
        ? "var(--hud-good)"
        : latencyMs < 100
          ? "var(--hud-amber)"
          : "var(--hud-danger)";

  const lossColour =
    lossPercent === 0
      ? "var(--hud-good)"
      : lossPercent < 2
        ? "var(--hud-amber)"
        : "var(--hud-danger)";

  return (
    <div className="w-full h-full p-1">
      <div
        className="
          h-full
          rounded-full
          border
          border-(--hud-border)
          bg-(--hud-bg-card)
          backdrop-blur-md
          px-3
          flex
          items-center
          justify-between
          select-none
        "
      >
        {/* Ping */}
        <div
          className="
            flex items-center gap-1
            font-mono
            text-[14px]
            font-semibold
            tabular-nums
          "
          style={{ color: pingColour }}
        >
          <span>{latencyText}</span>

          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: pingColour }}
          />
        </div>

        {/* Download */}
        <div
          className="
            flex items-center gap-1
            text-(--hud-dn)
            font-mono
            text-[13px]
            font-medium
            tabular-nums
          "
        >
          <span>↓</span>
          <span>{downloadValue}</span>
          <span className="text-[10px] text-(--hud-muted)">
            {downloadUnit}
          </span>
        </div>

        {/* Upload */}
        <div
          className="
            flex items-center gap-1
            text-(--hud-up)
            font-mono
            text-[13px]
            font-medium
            tabular-nums
          "
        >
          <span>↑</span>
          <span>{uploadValue}</span>
          <span className="text-[10px] text-(--hud-muted)">
            {uploadUnit}
          </span>
        </div>

        {/* Loss */}
        <div
          className="
            font-mono
            text-[13px]
            font-semibold
            tabular-nums
          "
          style={{ color: lossColour }}
        >
          {lossText}
        </div>
      </div>
    </div>
  );
});