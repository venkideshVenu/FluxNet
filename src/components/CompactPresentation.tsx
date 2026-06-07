interface CompactPresentationProps {
  interfaceName: string;
  isConnected: boolean;
  intervalLabel: string;
  downloadValue: string;
  downloadUnit: string;
  uploadValue: string;
  uploadUnit: string;
  todayDownloadValue: string;
  todayDownloadUnit: string;
  todayUploadValue: string;
  todayUploadUnit: string;
}

export function CompactPresentation({
  interfaceName,
  isConnected,
  intervalLabel,
  downloadValue,
  downloadUnit,
  uploadValue,
  uploadUnit,
  todayDownloadValue,
  todayDownloadUnit,
  todayUploadValue,
  todayUploadUnit,
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
            <span className="cw-num">{downloadValue}</span>
            <span className="cw-unit">{downloadUnit}</span>
          </span>
        </div>
        <div className="cw-speed-row">
          <span className="cw-speed-label">
            <span className="cw-dir up" /> Upload
          </span>
          <span className="cw-speed-value">
            <span className="cw-num">{uploadValue}</span>
            <span className="cw-unit">{uploadUnit}</span>
          </span>
        </div>
      </div>

      <div className="cw-divider" />

      <div className="cw-today-row">
        <span className="cw-today-label">Today</span>
        <span className="cw-today-values">
          <span className="cw-today-item">
            <span className="cw-dir dn" />
            <span className="cw-today-num">{todayDownloadValue}</span>
            <span className="cw-today-unit">{todayDownloadUnit}</span>
          </span>
          <span className="cw-today-item">
            <span className="cw-dir up" />
            <span className="cw-today-num">{todayUploadValue}</span>
            <span className="cw-today-unit">{todayUploadUnit}</span>
          </span>
        </span>
      </div>
    </div>
  );
}
