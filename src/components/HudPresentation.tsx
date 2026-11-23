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
// Sized by its content (the window is fitted to it). Each value has room for
// its usual widest text so the bar doesn't change width as values change.

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
    <div className="w-max p-0.5">
      <div
        className="
          h-8
          rounded-full
          border
          border-(--w-stroke)
          bg-(--w-bg)
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
          <span className="min-w-[5ch] font-semibold">{latencyText}</span>
        </div>

        {/* Traffic */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1 text-(--w-download)"
            title={compactDownload}
          >
            <span className="shrink-0">↓</span>
            <span className="min-w-[7ch]">{compactDownload}</span>
          </div>

          <div
            className="flex items-center gap-1 text-(--w-upload)"
            title={compactUpload}
          >
            <span className="shrink-0">↑</span>
            <span className="min-w-[7ch]">{compactUpload}</span>
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
          <span className="min-w-[4ch] text-right">{lossText}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Vertical Card ─────────────────────────────────────────────────────── */
// One grid for every row: label, value (right-aligned) and unit, so numbers
// and units line up whatever their width. Sized by its content.

function HudVertical({
  downloadValue,
  downloadUnit,
  uploadValue,
  uploadUnit,
  latencyMs,
  lossPercent,
}: HudPresentationProps) {
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

  const label =
    "font-mono text-[9px] font-bold uppercase tracking-wider text-(--w-fg-3)";
  const value = "min-w-[6ch] text-right text-[12px] font-semibold";
  const unit = "min-w-[4ch] text-[9px] text-(--w-fg-3)";
  const separator = "col-span-3 my-0.5 h-px bg-(--w-sep)";

  return (
    <div className="w-max p-0.5">
      <div
        className="
          grid grid-cols-[auto_auto_auto]
          items-baseline
          gap-x-1.5 gap-y-1
          rounded-lg
          border border-(--w-stroke)
          bg-(--w-bg)
          px-3 py-2
          font-mono tabular-nums leading-4
          select-none cursor-grab
        "
      >
        <span className={label}>Ping</span>
        <span className={value} style={{ color: pingColour }}>
          {latencyMs === null ? "—" : Math.round(latencyMs)}
        </span>
        <span className={unit}>{latencyMs === null ? "" : "ms"}</span>

        <span className={separator} />

        <span className="text-[11px] font-bold text-(--w-download)">↓</span>
        <span className={`${value} text-(--w-download)`}>{downloadValue}</span>
        <span className={unit}>{downloadUnit}</span>

        <span className="text-[11px] font-bold text-(--w-upload)">↑</span>
        <span className={`${value} text-(--w-upload)`}>{uploadValue}</span>
        <span className={unit}>{uploadUnit}</span>

        <span className={separator} />

        <span className={label}>Loss</span>
        <span className={value} style={{ color: lossColour }}>
          {lossPercent.toFixed(1)}
        </span>
        <span className={unit}>%</span>
      </div>
    </div>
  );
}
