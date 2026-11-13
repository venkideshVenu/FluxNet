import { memo } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

export interface PillPresentationProps {
  downloadValue: string;
  downloadUnit: string;
  uploadValue: string;
  uploadUnit: string;
  isConnected: boolean;
  hasInterface?: boolean;
}

function Reading({
  direction,
  value,
  unit,
}: {
  direction: "down" | "up";
  value: string;
  unit: string;
}) {
  const Arrow = direction === "down" ? ArrowDown : ArrowUp;
  return (
    <span className="flex items-center gap-1">
      {/* Fixed width (arrow + 6ch for "1023.9") so the pill never reflows;
          the arrow stays next to the number. */}
      <span className="flex w-[calc(6ch+14px)] items-center justify-end gap-1 text-[13px]">
        <Arrow
          aria-hidden="true"
          strokeWidth={2.5}
          className={`size-2.5 shrink-0 ${direction === "down" ? "text-(--w-download)" : "text-(--w-upload)"}`}
        />
        <span className="max-w-[6ch] min-w-0 overflow-hidden text-right text-[13px] leading-none font-semibold text-ellipsis whitespace-nowrap text-(--w-fg) tabular-nums">
          {value}
        </span>
      </span>
      <span className="w-[4.2ch] text-[10px] leading-none text-(--w-fg-2)">
        {unit}
      </span>
    </span>
  );
}

/** Slim speed bar. Window: 232 × 32 logical px. */
export const PillPresentation = memo(function PillPresentation({
  downloadValue,
  downloadUnit,
  uploadValue,
  uploadUnit,
  isConnected,
  hasInterface = true,
}: PillPresentationProps) {
  const state = !hasInterface ? "no-interface" : isConnected ? "live" : "dead";
  const dotColour =
    state === "live"
      ? "bg-(--w-good)"
      : state === "dead"
        ? "bg-(--w-idle)"
        : "bg-(--w-bad)";

  return (
    <div className="flex h-full w-full cursor-grab items-center justify-center gap-1.5 rounded-full border border-(--w-stroke) bg-(--w-bg) px-3 font-sans active:cursor-grabbing">
      <Reading direction="down" value={downloadValue} unit={downloadUnit} />
      <span className="h-3.5 w-px bg-(--w-sep)" aria-hidden="true" />
      <Reading direction="up" value={uploadValue} unit={uploadUnit} />
      <span
        className={`size-1.5 shrink-0 rounded-full ${dotColour}`}
        data-state={state}
        aria-hidden="true"
      />
    </div>
  );
});
