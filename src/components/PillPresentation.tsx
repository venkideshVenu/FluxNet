interface PillPresentationProps {
  downloadValue: string;
  downloadUnit: string;
  uploadValue: string;
  uploadUnit: string;
  isConnected: boolean;
}

export function PillPresentation({
  downloadValue,
  downloadUnit,
  uploadValue,
  uploadUnit,
  isConnected,
}: PillPresentationProps) {
  const unitClass = (unit: string) => {
    switch (unit) {
      case "GB/s":
        return "unit-gb";
      case "MB/s":
        return "unit-mb";
      case "KB/s":
        return "unit-kb";
      default:
        return "unit-b";
    }
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
}
