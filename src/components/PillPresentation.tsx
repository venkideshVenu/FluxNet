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
      return "text-[#39e48a] border-[rgba(57,228,138,0.55)] bg-[rgba(12,78,52,0.42)] [[data-theme='light']_&]:text-[#0c6a3a] [[data-theme='light']_&]:border-[rgba(12,106,58,0.35)] [[data-theme='light']_&]:bg-[rgba(57,228,138,0.18)]";
    if (u.startsWith("mb") || u === "mb/s" || u === "mbps")
      return "text-[#ff9f4a] border-[rgba(255,159,74,0.55)] bg-[rgba(90,54,18,0.45)] [[data-theme='light']_&]:text-[#8a4a0a] [[data-theme='light']_&]:border-[rgba(138,74,10,0.35)] [[data-theme='light']_&]:bg-[rgba(255,159,74,0.2)]";
    if (u.startsWith("kb") || u === "kb/s" || u === "kbps")
      return "text-[#4bd4ff] border-[rgba(75,212,255,0.52)] bg-[rgba(12,62,82,0.42)] [[data-theme='light']_&]:text-[#0a5a78] [[data-theme='light']_&]:border-[rgba(10,90,120,0.35)] [[data-theme='light']_&]:bg-[rgba(75,212,255,0.18)]";
    return "text-[#c9ccd6] border-[rgba(201,204,214,0.35)] bg-[rgba(86,92,104,0.22)] [[data-theme='light']_&]:text-[#2b2d3a] [[data-theme='light']_&]:border-[rgba(26,24,48,0.2)] [[data-theme='light']_&]:bg-[rgba(26,24,48,0.08)]";
  };

  return (
    <div
      className="inline-flex items-center bg-(--pill-bg) border border-(--pill-border) text-(--pill-text) rounded-full px-2.5 py-[5px] gap-[7px] w-max backdrop-blur-[18px] cursor-grab active:cursor-grabbing"
      role="status"
    >
      <div className="flex items-center gap-1.5 w-[66px] shrink-0">
        <span className="text-[12px] font-bold font-mono leading-none tracking-[-0.03em] w-[34px] text-right tabular-nums overflow-hidden whitespace-nowrap text-net-download">
          {downloadValue}
        </span>
        <span
          className={`text-[7px] font-bold font-mono inline-flex items-center justify-center w-[30px] min-w-[30px] h-[15px] rounded-[5px] leading-none tracking-[0.05em] shrink-0 ${unitClass(downloadUnit)}`}
        >
          {downloadUnit}
        </span>
      </div>
      <div className="w-px h-[13px] bg-(--pill-sep) mx-px" />
      <div className="flex items-center gap-1.5 w-[66px] shrink-0">
        <span className="text-[12px] font-bold font-mono leading-none tracking-[-0.03em] w-[34px] text-right tabular-nums overflow-hidden whitespace-nowrap text-net-upload">
          {uploadValue}
        </span>
        <span
          className={`text-[7px] font-bold font-mono inline-flex items-center justify-center w-[30px] min-w-[30px] h-[15px] rounded-[5px] leading-none tracking-[0.05em] shrink-0 ${unitClass(uploadUnit)}`}
        >
          {uploadUnit}
        </span>
      </div>
      <div
        className={`w-[7px] h-[7px] ml-0.5 rounded-full ${
          isConnected
            ? "bg-[#22d97d] shadow-[0_0_6px_rgba(34,217,125,0.7),0_0_10px_rgba(34,217,125,0.2)]"
            : "bg-[#5c5875] shadow-none"
        }`}
        aria-hidden="true"
      />
    </div>
  );
});
