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
      {/* Room for "999.9" so the pill doesn't change width as values
          change; the arrow stays next to the number. */}
      <span className="flex min-w-[calc(5ch+12px)] items-center justify-end gap-0.5">
        <Arrow
          aria-hidden="true"
          strokeWidth={2.5}
          className={`size-2.5 shrink-0 ${direction === "down" ? "text-(--w-download)" : "text-(--w-upload)"}`}
        />
        <span className="text-[12px] leading-none font-semibold whitespace-nowrap text-(--w-fg) tabular-nums">
          {value}
        </span>
      </span>
      <span className="min-w-[4ch] text-[10px] leading-none whitespace-nowrap text-(--w-fg-2)">
        {unit}
      </span>
    </span>
  );
}

/** Slim speed bar. Sized by its content; the window is fitted to it. */
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
    <div className="flex h-7 w-max cursor-grab items-center gap-1.5 rounded-full border border-(--w-stroke) bg-(--w-bg) pr-2.5 pl-3 font-sans active:cursor-grabbing">
      <span
        className={`size-1.5 shrink-0 rounded-full ${dotColour}`}
        data-state={state}
        aria-hidden="true"
      />
      <Reading direction="down" value={downloadValue} unit={downloadUnit} />
      <span className="h-3.5 w-px bg-(--w-sep)" aria-hidden="true" />
      <Reading direction="up" value={uploadValue} unit={uploadUnit} />
    </div>
  );
});
