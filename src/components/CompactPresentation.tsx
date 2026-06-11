import { memo } from "react";

export interface SpeedStat {
  value: string;
  unit: string;
}

export interface CompactPresentationProps {
  interfaceName: string;
  isConnected: boolean;
  intervalLabel: string;
  download: SpeedStat;
  upload: SpeedStat;
  todayDownload: SpeedStat;
  todayUpload: SpeedStat;
}

export const CompactPresentation = memo(function CompactPresentation({
  interfaceName,
  isConnected,
  intervalLabel,
  download,
  upload,
  todayDownload,
  todayUpload,
}: CompactPresentationProps) {
  return (
    <div
      className="w-[180px] max-w-full rounded-xl px-2 py-2 flex flex-col gap-0 cursor-default font-mono antialiased bg-[rgb(18,16,32)] border border-[#2a2650] [[data-theme='light']_&]:bg-[rgb(255,255,255)] [[data-theme='light']_&]:border-[rgba(24,33,61,0.12)] [[data-theme='light']_&]:shadow-[0_8px_24px_rgba(15,23,42,0.1),0_2px_8px_rgba(15,23,42,0.06)]"
      role="status"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-[7px]">
        <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-[#5b5890] [[data-theme='light']_&]:text-[#667394]">
          FluxNet
        </span>
        <div
          data-drag-handle="true"
          className="w-[22px] h-[15px] rounded-sm bg-transparent cursor-grab flex items-center justify-center transition-opacity hover:opacity-85 active:cursor-grabbing active:opacity-100 before:content-[''] before:w-3 before:h-0.5 before:rounded-sm before:bg-[#2e2b50] [[data-theme='light']_&]:before:bg-[#c8c5e0]"
          aria-hidden="true"
        />
      </div>

      {/* Status Row */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <div className="flex flex-col min-w-0">
          <span className="text-[8px] font-semibold tracking-[0.11em] uppercase whitespace-nowrap overflow-hidden text-ellipsis text-[#eae9ff] [[data-theme='light']_&]:text-[#18213d]">
            {interfaceName || "—"}
          </span>
          <span className="text-[8px] text-[#5b5890] [[data-theme='light']_&]:text-[#6d7897]">
            {isConnected ? "Connected" : "No signal"}
          </span>
        </div>
        <div className="flex items-center gap-[5px] shrink-0">
          <span className="inline-flex items-center gap-1 text-[8px] font-semibold bg-[#1e1c3a] text-[#b0aaff] rounded-full px-1.5 py-0.5 [[data-theme='light']_&]:bg-[rgba(72,99,255,0.08)] [[data-theme='light']_&]:text-[#32437a]">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300 ${
                isConnected
                  ? "bg-net-upload shadow-[0_0_4px_rgba(34,201,122,0.5)]"
                  : "bg-[#2e2b50] [[data-theme='light']_&]:bg-[#c8c5f5]"
              }`}
            />
            {isConnected ? "Live" : "Offline"}
          </span>
          <span className="text-[8px] text-[#3d3a70] [[data-theme='light']_&]:text-[#7c88a8]">
            {intervalLabel}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px my-[5px] bg-[#242046] [[data-theme='light']_&]:bg-[rgba(24,33,61,0.08)]" />

      {/* Speeds */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-[7px]">
          <span className="inline-flex items-center gap-[5px] text-[8px] font-semibold tracking-[0.11em] uppercase text-[#8e89c8] [[data-theme='light']_&]:text-[#55607f]">
            <span className="w-[7px] h-[7px] rounded-sm inline-block shrink-0 bg-net-download" />{" "}
            Download
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-[15px] font-medium tracking-[-0.02em] tabular-nums leading-none min-w-[36px] text-right text-[#eae9ff] [[data-theme='light']_&]:text-[#18213d]">
              {download.value}
            </span>
            <span className="text-[9px] font-normal leading-none self-end mb-px text-[#5b5890] [[data-theme='light']_&]:text-[#7c88a8]">
              {download.unit}
            </span>
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-[7px]">
          <span className="inline-flex items-center gap-[5px] text-[8px] font-semibold tracking-[0.11em] uppercase text-[#8e89c8] [[data-theme='light']_&]:text-[#55607f]">
            <span className="w-[7px] h-[7px] rounded-sm inline-block shrink-0 bg-net-upload" />{" "}
            Upload
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-[15px] font-medium tracking-[-0.02em] tabular-nums leading-none min-w-[36px] text-right text-[#eae9ff] [[data-theme='light']_&]:text-[#18213d]">
              {upload.value}
            </span>
            <span className="text-[9px] font-normal leading-none self-end mb-px text-[#5b5890] [[data-theme='light']_&]:text-[#7c88a8]">
              {upload.unit}
            </span>
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px my-[5px] bg-[#242046] [[data-theme='light']_&]:bg-[rgba(24,33,61,0.08)]" />

      {/* Today */}
      <div className="flex items-center justify-between gap-[7px]">
        <span className="text-[8px] tracking-[0.11em] uppercase text-[#5b5890] [[data-theme='light']_&]:text-[#55607f]">
          Today
        </span>
        <span className="inline-flex items-center gap-[7px]">
          <span className="inline-flex items-baseline gap-1 tabular-nums">
            <span className="w-[7px] h-[7px] rounded-sm inline-block shrink-0 bg-net-download" />
            <span className="text-[15px] font-semibold text-[#eae9ff] [[data-theme='light']_&]:text-[#18213d]">
              {todayDownload.value}
            </span>
            <span className="text-[9px] text-[#5b5890] [[data-theme='light']_&]:text-[#7c88a8]">
              {todayDownload.unit}
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1 tabular-nums">
            <span className="w-[7px] h-[7px] rounded-sm inline-block shrink-0 bg-net-upload" />
            <span className="text-[15px] font-semibold text-[#eae9ff] [[data-theme='light']_&]:text-[#18213d]">
              {todayUpload.value}
            </span>
            <span className="text-[9px] text-[#5b5890] [[data-theme='light']_&]:text-[#7c88a8]">
              {todayUpload.unit}
            </span>
          </span>
        </span>
      </div>
    </div>
  );
});
