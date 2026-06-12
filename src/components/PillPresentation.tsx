import { memo } from "react";

export interface PillPresentationProps {
  downloadValue: string;
  downloadUnit: string;
  uploadValue: string;
  uploadUnit: string;
  isConnected: boolean;
}

export const PillPresentation = memo(function PillPresentation({
  downloadValue,
  downloadUnit,
  uploadValue,
  uploadUnit,
  isConnected,
}: PillPresentationProps) {
  const unitClass = (unit: string) => {
    const u = unit.toLowerCase();
    if (u.startsWith("gb") || u === "gb/s" || u === "gbps")
      return "text-[#39e48a] bg-[rgba(12,78,52,0.42)] in-data-[theme='light']_&]:text-[#0c6a3a] in-data-[theme='light']_&]:bg-[rgba(12,106,58,0.15)]";
    if (u.startsWith("mb") || u === "mb/s" || u === "mbps")
      return "text-[#ff9f4a] bg-[rgba(90,54,18,0.45)] in-data-[theme='light']_&]:text-[#8a4a0a] in-data-[theme='light']_&]:bg-[rgba(138,74,10,0.12)]";
    if (u.startsWith("kb") || u === "kb/s" || u === "kbps")
      return "text-[#4bd4ff] bg-[rgba(12,62,82,0.42)] in-data-[theme='light']_&]:text-[#0a5a78] in-data-[theme='light']_&]:bg-[rgba(10,90,120,0.12)]";
    return "text-[#c9ccd6] bg-[rgba(86,92,104,0.22)] in-data-[theme='light']_&]:text-[#4a4d5a] in-data-[theme='light']_&]:bg-[rgba(26,24,48,0.1)]";
  };

  return (
    <div
      className="inline-flex items-center bg-(--pill-bg) border border-(--pill-border) text-(--pill-text) rounded-full px-2.5 py-1.25 gap-1.75 w-max cursor-grab active:cursor-grabbing"
      role="status"
    >
      <div className="flex items-center gap-1.5 w-16.5 shrink-0">
        <span className="text-[12px] font-bold font-mono leading-none tracking-[-0.03em] w-8.5 text-right tabular-nums overflow-hidden whitespace-nowrap text-net-download">
          {downloadValue}
        </span>
        <span
          className={`text-[7px] font-bold font-mono inline-flex items-center justify-center w-7.5 min-w-7.5 h-3.75 rounded-[5px] leading-none tracking-wider shrink-0 ${unitClass(downloadUnit)}`}
        >
          {downloadUnit}
        </span>
      </div>
      <div className="w-px h-3.25 bg-(--pill-sep) mx-px" />
      <div className="flex items-center gap-1.5 w-16.5 shrink-0">
        <span className="text-[12px] font-bold font-mono leading-none tracking-[-0.03em] w-8.5 text-right tabular-nums overflow-hidden whitespace-nowrap text-net-upload">
          {uploadValue}
        </span>
        <span
          className={`text-[7px] font-bold font-mono inline-flex items-center justify-center w-7.5 min-w-7.5 h-3.75 rounded-[5px] leading-none tracking-wider shrink-0 ${unitClass(uploadUnit)}`}
        >
          {uploadUnit}
        </span>
      </div>
      <div
        className={`w-1.75 h-1.75 ml-0.5 rounded-full ${
          isConnected
            ? "bg-[#22d97d] shadow-[0_0_6px_rgba(34,217,125,0.7),0_0_10px_rgba(34,217,125,0.2)]"
            : "bg-[#5c5875] shadow-none"
        }`}
        aria-hidden="true"
      />
    </div>
  );
});
