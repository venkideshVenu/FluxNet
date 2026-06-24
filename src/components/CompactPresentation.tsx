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
      className="w-full max-w-49 rounded-xl px-2 py-2 flex flex-col gap-0 cursor-default font-mono antialiased bg-[rgb(18,16,32)] border border-[#2a2650] in-data-[theme='light']:bg-[#f0eff8] in-data-[theme='light']:border-[rgba(60,50,140,0.18)]"
      role="status"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.75">
        <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-[#5b5890] in-data-[theme='light']:text-[#4a3db8]">
          FluxNet
        </span>
        <div
          data-drag-handle="true"
          className="w-5.5 h-3.75 rounded-sm bg-transparent cursor-grab flex items-center justify-center transition-opacity hover:opacity-85 active:cursor-grabbing active:opacity-100 before:content-[''] before:w-3 before:h-0.5 before:rounded-sm before:bg-[#2e2b50] in-data-[theme='light']:before:bg-[#b8b2f0]"
          aria-hidden="true"
        />
      </div>

      {/* Status Row */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <div className="flex flex-col min-w-0">
          <span className="text-[8px] font-semibold tracking-[0.11em] uppercase whitespace-nowrap overflow-hidden text-ellipsis text-[#eae9ff] in-data-[theme='light']:text-[#131020]">
            {interfaceName || "—"}
          </span>
          <span className="text-[8px] text-[#5b5890] in-data-[theme='light']:text-[#5a5478]">
            {isConnected ? "Connected" : "No signal"}
          </span>
        </div>
        <div className="flex items-center gap-1.25 shrink-0">
          <span className="inline-flex items-center gap-1 text-[8px] font-semibold bg-[#1e1c3a] text-[#b0aaff] rounded-full px-1.5 py-0.5 in-data-[theme='light']:bg-[rgba(108,92,231,0.1)] in-data-[theme='light']:text-[#4a3db8]">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300 ${
                isConnected
                  ? "bg-[#22c97a] shadow-[0_0_4px_rgba(34,201,122,0.5)] in-data-[theme='light']:bg-[#0f8c42] in-data-[theme='light']:shadow-[0_0_4px_rgba(15,140,66,0.4)]"
                  : "bg-[#2e2b50] in-data-[theme='light']:bg-[#b8b2f0]"
              }`}
            />
            {isConnected ? "Live" : "Offline"}
          </span>
          <span className="text-[8px] text-[#3d3a70] in-data-[theme='light']:text-[#5a5478]">
            {intervalLabel}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px my-1.25 bg-[#242046] in-data-[theme='light']:bg-[rgba(60,50,140,0.12)]" />

      {/* Speeds */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-1.75">
          <span className="inline-flex items-center gap-1.25 text-[8px] font-semibold tracking-[0.11em] uppercase text-[#8e89c8] in-data-[theme='light']:text-[#3d3760]">
            <span className="w-1.75 h-1.75 rounded-sm inline-block shrink-0 bg-net-download" />{" "}
            Download
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-[12px] font-medium tracking-[-0.02em] tabular-nums leading-none min-w-8 text-right text-[#eae9ff] in-data-[theme='light']:text-[#131020]">
              {download.value}
            </span>
            <span className="text-[9px] font-normal leading-none self-end mb-px text-[#5b5890] in-data-[theme='light']:text-[#5a5478]">
              {download.unit}
            </span>
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-1.75">
          <span className="inline-flex items-center gap-1.25 text-[8px] font-semibold tracking-[0.11em] uppercase text-[#8e89c8] in-data-[theme='light']:text-[#3d3760]">
            <span className="w-1.75 h-1.75 rounded-sm inline-block shrink-0 bg-net-upload" />{" "}
            Upload
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-[12px] font-medium tracking-[-0.02em] tabular-nums leading-none min-w-8 text-right text-[#eae9ff] in-data-[theme='light']:text-[#131020]">
              {upload.value}
            </span>
            <span className="text-[9px] font-normal leading-none self-end mb-px text-[#5b5890] in-data-[theme='light']:text-[#5a5478]">
              {upload.unit}
            </span>
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px my-1.25 bg-[#242046] in-data-[theme='light']:bg-[rgba(60,50,140,0.12)]" />

      {/* Today */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-[8px] tracking-[0.11em] uppercase text-[#5b5890] in-data-[theme='light']:text-[#3d3760]">
          Today
        </span>
        <span className="inline-flex items-center gap-1.75">
          <span className="inline-flex items-baseline gap-1 tabular-nums">
            <span className="w-1.75 h-1.75 rounded-sm inline-block shrink-0 bg-net-download" />
            <span className="text-[12px] font-semibold text-[#eae9ff] in-data-[theme='light']:text-[#131020]">
              {todayDownload.value}
            </span>
            <span className="text-[9px] text-[#5b5890] in-data-[theme='light']:text-[#5a5478]">
              {todayDownload.unit}
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1 tabular-nums">
            <span className="w-1.75 h-1.75 rounded-sm inline-block shrink-0 bg-net-upload" />
            <span className="text-[12px] font-semibold text-[#eae9ff] in-data-[theme='light']:text-[#131020]">
              {todayUpload.value}
            </span>
            <span className="text-[9px] text-[#5b5890] in-data-[theme='light']:text-[#5a5478]">
              {todayUpload.unit}
            </span>
          </span>
        </span>
      </div>
    </div>
  );
});
