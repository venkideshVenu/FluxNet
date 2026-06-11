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
    <div className="w-full h-full p-2 flex items-center justify-center">
      <div className="w-full h-full bg-[var(--hud-bg-card)] border border-[var(--hud-border)] rounded-xl grid grid-rows-[auto_1px_1fr_1px_1fr] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-[9px] cursor-default">
          <span className="text-[8px] font-semibold tracking-[0.15em] text-[var(--hud-brand)] uppercase">
            FLUXNET HUD
          </span>
          <button
            type="button"
            data-drag-handle="true"
            className="w-[22px] h-[15px] border-0 rounded-sm bg-transparent cursor-grab shrink-0 flex items-center justify-center transition-opacity p-0 hover:opacity-85 active:cursor-grabbing active:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--hud-amber)] focus-visible:outline-offset-2 before:content-[''] before:w-3 before:h-0.5 before:rounded-sm before:bg-[var(--hud-brand)]"
            title="Drag to move"
            aria-label="Drag HUD widget"
          />
        </div>

        {/* Rule */}
        <div className="h-px bg-[var(--hud-rule)] shrink-0" />

        {/* Speed rows */}
        <div className="flex flex-col p-0 min-h-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-2.5 py-1 min-h-0 flex-1">
            <span className="text-[7px] font-semibold tracking-[0.11em] uppercase text-[var(--hud-label)] flex items-center gap-[5px] min-w-0 whitespace-nowrap">
              <span className="opacity-70 text-[7px]">↓</span> DOWNLOAD
            </span>
            <span className="text-[14px] font-medium font-mono tabular-nums tracking-[-0.005em] leading-none flex items-baseline gap-0.5 min-w-[11ch] justify-end whitespace-nowrap text-right text-[var(--hud-dn)]">
              {downloadValue}{" "}
              <span className="text-[9px] font-normal text-[var(--hud-muted)]">
                {downloadUnit}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-2.5 py-1 min-h-0 flex-1">
            <span className="text-[7px] font-semibold tracking-[0.11em] uppercase text-[var(--hud-label)] flex items-center gap-[5px] min-w-0 whitespace-nowrap">
              <span className="opacity-70 text-[7px]">↑</span> UPLOAD
            </span>
            <span className="text-[14px] font-medium font-mono tabular-nums tracking-[-0.005em] leading-none flex items-baseline gap-0.5 min-w-[11ch] justify-end whitespace-nowrap text-right text-[var(--hud-up)]">
              {uploadValue}{" "}
              <span className="text-[9px] font-normal text-[var(--hud-muted)]">
                {uploadUnit}
              </span>
            </span>
          </div>
        </div>

        {/* Rule */}
        <div className="h-px bg-[var(--hud-rule)] shrink-0" />

        {/* Ping/Loss rows */}
        <div className="flex flex-col p-0 min-h-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-2.5 py-1 min-h-0 flex-1">
            <span className="text-[7px] font-semibold tracking-[0.11em] uppercase text-[var(--hud-label)] flex items-center gap-[5px] min-w-0 whitespace-nowrap">
              PING
            </span>
            <span
              className="text-[14px] font-medium font-mono tabular-nums tracking-[-0.005em] leading-none flex items-baseline gap-0.5 min-w-[11ch] justify-end whitespace-nowrap text-right"
              style={{ color: pingColour }}
            >
              {latencyText}
              {latencyMs !== null && (
                <span className="text-[9px] font-normal text-[var(--hud-muted)]">
                  ms
                </span>
              )}
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-2.5 py-1 min-h-0 flex-1">
            <span className="text-[7px] font-semibold tracking-[0.11em] uppercase text-[var(--hud-label)] flex items-center gap-[5px] min-w-0 whitespace-nowrap">
              LOSS
            </span>
            <span className="text-[14px] font-medium font-mono tabular-nums tracking-[-0.005em] leading-none flex items-baseline gap-0.5 min-w-[11ch] justify-end whitespace-nowrap text-right text-[var(--hud-neutral)]">
              {lossText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
