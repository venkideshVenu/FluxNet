import { memo } from "react";

export interface PillPresentationProps {
  downloadValue: string;
  downloadUnit: string;
  uploadValue: string;
  uploadUnit: string;
  isConnected: boolean;
  hasInterface?: boolean;
}

export const PillPresentation = memo(function PillPresentation({
  downloadValue,
  downloadUnit,
  uploadValue,
  uploadUnit,
  isConnected,
  hasInterface = true,
}: PillPresentationProps) {
  const unitClass = (unit: string) => {
    const u = unit.toLowerCase();
    if (u.startsWith("gb") || u === "gb/s" || u === "gbps")
      return "text-[#39e48a] bg-[rgba(12,78,52,0.42)] in-[[data-theme='light']]:text-[#066a30] in-[[data-theme='light']]:bg-[rgba(10,122,62,0.12)]";
    if (u.startsWith("mb") || u === "mb/s" || u === "mbps")
      return "text-[#ff9f4a] bg-[rgba(90,54,18,0.45)] in-[[data-theme='light']]:text-[#7a4200] in-[[data-theme='light']]:bg-[rgba(184,109,0,0.12)]";
    if (u.startsWith("kb") || u === "kb/s" || u === "kbps")
      return "text-[#4bd4ff] bg-[rgba(12,62,82,0.42)] in-[[data-theme='light']]:text-[#085070] in-[[data-theme='light']]:bg-[rgba(12,96,144,0.12)]";
    return "text-[#c9ccd6] bg-[rgba(86,92,104,0.22)] in-[[data-theme='light']]:text-[#3d3760] in-[[data-theme='light']]:bg-[rgba(60,50,100,0.08)]";
  };

  // Red when no interface, green when connected, grey when disconnected
  const dotColor = !hasInterface
    ? "bg-[#ef4444] shadow-[0_0_6px_rgba(239,68,68,0.6)]"
    : isConnected
      ? "bg-[#0f8c42] shadow-[0_0_6px_rgba(15,140,66,0.6)] in-data-[theme='dark']_&]:bg-[#22d97d] in-data-[theme='dark']_&]:shadow-[0_0_6px_rgba(34,217,125,0.7)]"
      : "bg-[#8a8590]";

  return (
    <div className="inline-flex items-center justify-center bg-(--pill-bg) border border-(--pill-border) ... rounded-full px-2.5 py-1.25 gap-1.75 w-full cursor-grab active:cursor-grabbing">
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
        className={`w-1.75 h-1.75 ml-0.5 rounded-full ${dotColor}`}
        aria-hidden="true"
      />
    </div>
  );
});
