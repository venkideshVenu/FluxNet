import { memo } from "react";

export type HudDesign = "horizontal" | "vertical";

export interface HudPresentationProps {
  downloadValue: string;
  downloadUnit: string;
  uploadValue: string;
  uploadUnit: string;
  latencyMs: number | null;
  lossPercent: number;
  design?: HudDesign;
}

export const HudPresentation = memo(function HudPresentation(
  props: HudPresentationProps,
) {
  const { design = "horizontal" } = props;
  return design === "vertical" ? (
    <HudVertical {...props} />
  ) : (
    <HudHorizontal {...props} />
  );
});

/* ── Horizontal ────────────────────────────────────────────────────────── */

function HudHorizontal({
  downloadValue,
  downloadUnit,
  uploadValue,
  uploadUnit,
  latencyMs,
  lossPercent,
}: HudPresentationProps) {
  const latencyText = latencyMs === null ? "—" : `${Math.round(latencyMs)}ms`;
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
    <div className="w-full h-full p-0.5">
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
          gap-3
          select-none
        "
      >
        {/* Ping */}
        <div
          className="flex items-center gap-1 font-mono text-[12px] font-semibold tabular-nums shrink-0"
          style={{ color: pingColour }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: pingColour }}
          />
          <span className="w-[42px] text-right">{latencyText}</span>
        </div>

        {/* Download */}
        <div className="flex items-center gap-0.5 text-(--hud-dn) font-mono text-[12px] font-medium tabular-nums shrink-0">
          <span>↓</span>
          <span className="w-[32px] text-right">{downloadValue}</span>
          <span className="text-[9px] text-(--hud-muted) w-[28px]">
            {downloadUnit}
          </span>
        </div>

        {/* Upload */}
        <div className="flex items-center gap-0.5 text-(--hud-up) font-mono text-[12px] font-medium tabular-nums shrink-0">
          <span>↑</span>
          <span className="w-[32px] text-right">{uploadValue}</span>
          <span className="text-[9px] text-(--hud-muted) w-[28px]">
            {uploadUnit}
          </span>
        </div>

        {/* Loss */}
        <div
          className="font-mono text-[12px] font-semibold tabular-nums shrink-0 w-[24px] text-right"
          style={{ color: lossColour }}
        >
          {lossText}
        </div>
      </div>
    </div>
  );
}

/* ── Vertical Card ─────────────────────────────────────────────────────── */

function HudVertical({
  downloadValue,
  downloadUnit,
  uploadValue,
  uploadUnit,
  latencyMs,
  lossPercent,
}: HudPresentationProps) {
  const latencyText = latencyMs === null ? "—" : `${Math.round(latencyMs)}ms`;

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
    <div className="w-full h-full p-0.5">
      <div
        className="
          h-full w-full
          rounded-lg
          border
          border-(--hud-border)
          bg-(--hud-bg-card)
          backdrop-blur-md
          flex flex-col
          justify-center
          select-none
          py-1.5
          px-2.5
          gap-0.5
        "
      >
        {/* Ping row */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: pingColour }}
          />
          <span
            className="font-mono text-[11px] font-semibold tabular-nums"
            style={{ color: pingColour }}
          >
            {latencyText}
          </span>
        </div>

        {/* Separator */}
        <div className="h-px bg-(--hud-rule) my-0.5" />

        {/* Speed rows */}
        <div className="flex flex-col gap-0">
          <div className="flex items-center gap-1 text-(--hud-dn) font-mono text-[10px] font-medium tabular-nums">
            <span>↓</span>
            <span className="w-[28px] text-right">{downloadValue}</span>
            <span className="text-[8px] text-(--hud-muted)">
              {downloadUnit}
            </span>
          </div>
          <div className="flex items-center gap-1 text-(--hud-up) font-mono text-[10px] font-medium tabular-nums">
            <span>↑</span>
            <span className="w-[28px] text-right">{uploadValue}</span>
            <span className="text-[8px] text-(--hud-muted)">{uploadUnit}</span>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-(--hud-rule) my-0.5" />

        {/* Loss row */}
        <div className="flex items-center gap-1">
          <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-(--hud-muted)">
            LOSS
          </span>
          <span
            className="font-mono text-[10px] font-semibold tabular-nums"
            style={{ color: lossColour }}
          >
            {lossPercent.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
