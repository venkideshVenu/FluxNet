import { memo } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

export interface SpeedStat {
  value: string;
  unit: string;
}

export interface CompactPresentationProps {
  interfaceName: string;
  isConnected: boolean;
  /** Kept for callers; the refresh rate is not shown on the widget. */
  intervalLabel?: string;
  download: SpeedStat;
  upload: SpeedStat;
  todayDownload: SpeedStat;
  todayUpload: SpeedStat;
}

function Speed({
  direction,
  stat,
}: {
  direction: "down" | "up";
  stat: SpeedStat;
}) {
  const Arrow = direction === "down" ? ArrowDown : ArrowUp;
  return (
    <div className="flex items-center gap-2">
      <Arrow
        aria-label={direction === "down" ? "Download" : "Upload"}
        strokeWidth={2.5}
        className={`size-3.5 shrink-0 ${direction === "down" ? "text-(--w-download)" : "text-(--w-upload)"}`}
      />
      <span className="flex items-baseline gap-1 tabular-nums">
        {/* Room for "999.9" so the card doesn't change width. */}
        <span className="min-w-[5ch] text-right text-[20px] leading-6 font-semibold text-(--w-fg)">
          {stat.value}
        </span>
        <span className="text-[12px] text-(--w-fg-2)">{stat.unit}</span>
      </span>
    </div>
  );
}

function Total({
  direction,
  stat,
}: {
  direction: "down" | "up";
  stat: SpeedStat;
}) {
  return (
    <span className="flex items-baseline gap-1 tabular-nums">
      <span
        className={
          direction === "down" ? "text-(--w-download)" : "text-(--w-upload)"
        }
      >
        {direction === "down" ? "↓" : "↑"}
      </span>
      <span className="text-(--w-fg)">{stat.value}</span>
      <span className="text-(--w-fg-2)">{stat.unit}</span>
    </span>
  );
}

/** Small card with speeds and today's totals. Sized by its content; the
 *  window is fitted to it. */
export const CompactPresentation = memo(function CompactPresentation({
  interfaceName,
  isConnected,
  download,
  upload,
  todayDownload,
  todayUpload,
}: CompactPresentationProps) {
  return (
    <div
      className="flex w-max min-w-[148px] cursor-default flex-col rounded-[8px] border border-(--w-stroke) bg-(--w-bg) px-3 py-2.5 font-sans"
      role="status"
    >
      <div className="flex items-center gap-2" data-drag-handle="true">
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${isConnected ? "bg-(--w-good)" : "bg-(--w-idle)"}`}
        />
        <span className="max-w-[104px] min-w-0 flex-1 truncate text-[12px] leading-4 text-(--w-fg-2)">
          {interfaceName || "No adapter"}
          {interfaceName && !isConnected && " · Offline"}
        </span>
        {/* Grip: the whole header row drags the widget. */}
        <span
          aria-hidden="true"
          className="flex cursor-grab flex-col gap-[3px] px-0.5 active:cursor-grabbing"
        >
          <span className="h-px w-3 bg-(--w-fg-3)" />
          <span className="h-px w-3 bg-(--w-fg-3)" />
        </span>
      </div>

      <div className="mt-2 flex flex-col gap-0.5">
        <Speed direction="down" stat={download} />
        <Speed direction="up" stat={upload} />
      </div>

      <div className="mt-2 border-t border-(--w-sep) pt-1.5">
        <div className="text-[11px] leading-4 text-(--w-fg-2)">Today</div>
        <div className="flex items-baseline justify-between gap-3 text-[12px] leading-4">
          <Total direction="down" stat={todayDownload} />
          <Total direction="up" stat={todayUpload} />
        </div>
      </div>
    </div>
  );
});
