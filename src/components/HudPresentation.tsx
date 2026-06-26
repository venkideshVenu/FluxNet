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
// Window size: 380 × 36 (was 320 × 36) — gives loss room to breathe

function HudHorizontal({
  downloadValue,
  downloadUnit,
  uploadValue,
  uploadUnit,
  latencyMs,
  lossPercent,
}: HudPresentationProps) {
  const latencyText = latencyMs === null ? "—" : `${Math.round(latencyMs)}ms`;
  const lossText = `${lossPercent.toFixed(1)}%`;

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

  const compactDownload = `${downloadValue}${downloadUnit.replace("/s", "")}`;
  const compactUpload = `${uploadValue}${uploadUnit.replace("/s", "")}`;

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
          justify-between
          mouse:cursor-grab
          select-none
          font-mono
          text-[12px]
          tabular-nums
        "
      >
        {/* Ping */}
        <div
          className="flex items-center gap-1 shrink-0"
          style={{ color: pingColour }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: pingColour }}
          />
          <span className="font-semibold">{latencyText}</span>
        </div>

        {/* Traffic */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1 text-(--hud-dn)">
            <span>↓</span>
            <span>{compactDownload}</span>
          </div>

          <div className="flex items-center gap-1 text-(--hud-up)">
            <span>↑</span>
            <span>{compactUpload}</span>
          </div>
        </div>

        {/* Loss */}
        <div
          className="flex items-center gap-1 shrink-0 font-semibold"
          style={{ color: lossColour }}
        >
          <span className="text-[9px] uppercase tracking-wide text-(--hud-muted)">
            LOSS
          </span>
          <span>{lossText}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Vertical Card ─────────────────────────────────────────────────────── */
// Window size: 150 × 130 (was 130 × 105) — more breathing room, larger text

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
          cursor-grab
          py-2
          px-3
          gap-1
        "
      >
        {/* Ping row — bumped to 13px, dot slightly larger */}
        <div className="flex items-center justify-between">
          <span
            data-tauri-drag-region
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: pingColour }}
          />

          <span
            className="font-mono text-[13px] font-semibold tabular-nums leading-none"
            style={{ color: pingColour }}
          >
            {latencyText}
          </span>
        </div>

        {/* Separator */}
        <div className="h-px bg-(--hud-rule)" />

        {/* Download row — bumped to 12px */}
        <div className="flex items-center justify-between text-(--hud-dn) font-mono text-[12px] font-medium tabular-nums">
          <span className="text-[10px] font-bold">↓</span>
          <span>
            {downloadValue}{" "}
            <span className="text-[9px] text-(--hud-muted)">
              {downloadUnit}
            </span>
          </span>
        </div>

        {/* Upload row */}
        <div className="flex items-center justify-between text-(--hud-up) font-mono text-[12px] font-medium tabular-nums">
          <span className="text-[10px] font-bold">↑</span>
          <span>
            {uploadValue}{" "}
            <span className="text-[9px] text-(--hud-muted)">{uploadUnit}</span>
          </span>
        </div>

        {/* Separator */}
        <div className="h-px bg-(--hud-rule)" />

        {/* Loss row — bumped to 12px */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-(--hud-muted)">
            LOSS
          </span>
          <span
            className="font-mono text-[12px] font-semibold tabular-nums"
            style={{ color: lossColour }}
          >
            {lossPercent.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
