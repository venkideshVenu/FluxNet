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

// Custom comparator checks nested SpeedStat objects for equality.
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
    <div className="cw-root" role="status">
      <div className="cw-header">
        <span className="cw-brand">FluxNet</span>
        <div className="cw-drag-handle" aria-hidden="true" />
      </div>

      <div className="cw-status-row">
        <div className="cw-iface">
          <span className="cw-iface-name">{interfaceName || "—"}</span>
          <span className="cw-iface-sub">
            {isConnected ? "Connected" : "No signal"}
          </span>
        </div>
        <div className="cw-status-right">
          <span className="cw-status-pill">
            <span className={`cw-live-dot ${isConnected ? "live" : "dead"}`} />
            {isConnected ? "Live" : "Offline"}
          </span>
          <span className="cw-interval">{intervalLabel}</span>
        </div>
      </div>

      <div className="cw-divider" />

      <div className="cw-speeds">
        <div className="cw-speed-row">
          <span className="cw-speed-label">
            <span className="cw-dir dn" /> Download
          </span>
          <span className="cw-speed-value">
            <span className="cw-num">{download.value}</span>
            <span className="cw-unit">{download.unit}</span>
          </span>
        </div>
        <div className="cw-speed-row">
          <span className="cw-speed-label">
            <span className="cw-dir up" /> Upload
          </span>
          <span className="cw-speed-value">
            <span className="cw-num">{upload.value}</span>
            <span className="cw-unit">{upload.unit}</span>
          </span>
        </div>
      </div>

      <div className="cw-divider" />

      <div className="cw-today-row">
        <span className="cw-today-label">Today</span>
        <span className="cw-today-values">
          <span className="cw-today-item">
            <span className="cw-dir dn" />
            <span className="cw-today-num">{todayDownload.value}</span>
            <span className="cw-today-unit">{todayDownload.unit}</span>
          </span>
          <span className="cw-today-item">
            <span className="cw-dir up" />
            <span className="cw-today-num">{todayUpload.value}</span>
            <span className="cw-today-unit">{todayUpload.unit}</span>
          </span>
        </span>
      </div>
    </div>
  );
});
