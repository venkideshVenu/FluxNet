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
// Window size: 300 × 36 logical (see `hud_size_for_design` in visibility.rs).
// Ping and loss keep their width; the traffic column shrinks with an ellipsis
// when the largest values ("1023.9KB") or Windows text scaling need more room.

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
      ? "var(--w-fg-3)"
      : latencyMs < 50
        ? "var(--w-good)"
        : latencyMs < 100
          ? "var(--w-warn)"
          : "var(--w-bad)";

  const lossColour =
    lossPercent === 0
      ? "var(--w-good)"
      : lossPercent < 2
        ? "var(--w-warn)"
        : "var(--w-bad)";

  const compactDownload = `${downloadValue}${downloadUnit.replace("/s", "")}`;
  const compactUpload = `${uploadValue}${uploadUnit.replace("/s", "")}`;

  return (
    <div className="w-full h-full p-0.5">
      <div
        className="
          h-full
          rounded-full
          border
          border-(--w-stroke)
          bg-(--w-overlay)
          px-2.5
          gap-2
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
        <div className="flex items-center justify-center gap-3 min-w-0 shrink">
          <div
            className="flex items-center gap-1 min-w-0 text-(--w-download)"
            title={compactDownload}
          >
            <span className="shrink-0">↓</span>
            <span className="truncate">{compactDownload}</span>
          </div>

          <div
            className="flex items-center gap-1 min-w-0 text-(--w-upload)"
            title={compactUpload}
          >
            <span className="shrink-0">↑</span>
            <span className="truncate">{compactUpload}</span>
          </div>
        </div>

        {/* Loss */}
        <div
          className="flex items-center gap-1 shrink-0 font-semibold"
          style={{ color: lossColour }}
        >
          <span className="text-[9px] uppercase tracking-wide text-(--w-fg-3)">
            LOSS
          </span>
          <span>{lossText}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Vertical Card ─────────────────────────────────────────────────────── */
// Window size: 120 × 130 logical (see `hud_size_for_design` in visibility.rs).

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
      ? "var(--w-fg-3)"
      : latencyMs < 50
        ? "var(--w-good)"
        : latencyMs < 100
          ? "var(--w-warn)"
          : "var(--w-bad)";

  const lossColour =
    lossPercent === 0
      ? "var(--w-good)"
      : lossPercent < 2
        ? "var(--w-warn)"
        : "var(--w-bad)";

  return (
    <div className="w-full h-full p-0.5">
      <div
        className="
          h-full w-full
          rounded-lg
          border
          border-(--w-stroke)
          bg-(--w-overlay)
          flex flex-col
          justify-center
          select-none
          cursor-grab
          py-2
          px-3
          gap-1
        "
      >
        {/* Ping */}
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
        <div className="h-px bg-(--w-sep)" />

        {/* Download */}
        <div className="flex items-center justify-between text-(--w-download) font-mono text-[12px] font-medium tabular-nums">
          <span className="text-[10px] font-bold">↓</span>
          <span>
            {downloadValue}{" "}
            <span className="text-[9px] text-(--w-fg-3)">
              {downloadUnit}
            </span>
          </span>
        </div>

        {/* Upload row */}
        <div className="flex items-center justify-between text-(--w-upload) font-mono text-[12px] font-medium tabular-nums">
          <span className="text-[10px] font-bold">↑</span>
          <span>
            {uploadValue}{" "}
            <span className="text-[9px] text-(--w-fg-3)">{uploadUnit}</span>
          </span>
        </div>

        {/* Separator */}
        <div className="h-px bg-(--w-sep)" />

        {/* Loss */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-(--w-fg-3)">
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
