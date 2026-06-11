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
    if (u.startsWith("gb") || u === "gb/s" || u === "gbps") return "unit-gb";
    if (u.startsWith("mb") || u === "mb/s" || u === "mbps") return "unit-mb";
    if (u.startsWith("kb") || u === "kb/s" || u === "kbps") return "unit-kb";
    return "unit-b";
  };

  return (
    <div className="pill-root" role="status">
      <div className="pill-stat download">
        <span className="pill-value download">{downloadValue}</span>
        <span className={`pill-unit ${unitClass(downloadUnit)}`}>
          {downloadUnit}
        </span>
      </div>
      <div className="pill-sep" />
      <div className="pill-stat upload">
        <span className="pill-value upload">{uploadValue}</span>
        <span className={`pill-unit ${unitClass(uploadUnit)}`}>
          {uploadUnit}
        </span>
      </div>
      <div
        className={`pill-live-dot ${isConnected ? "live" : "dead"}`}
        aria-hidden="true"
      />
    </div>
  );
});
