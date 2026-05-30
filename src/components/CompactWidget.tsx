import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNetworkStore } from "../store/networkStore";
import { formatSpeed } from "../utils/formatSpeed";

// Generate bar heights for the mini chart
// Takes the last N history points and normalises to max bar height
function buildBars(values: number[], count: number, maxHeight: number): number[] {
  const slice = values.slice(-count);
  const max = Math.max(...slice, 1);
  return Array.from({ length: count }, (_, i) => {
    const v = slice[i] ?? 0;
    return Math.max(3, Math.round((v / max) * maxHeight));
  });
}

export function CompactWidget() {
  const { data, isConnected, history } = useNetworkStore();

  const up = formatSpeed(data.uploadBytesPerSec);
  const dn = formatSpeed(data.downloadBytesPerSec);

  const upValues  = history.map((p) => p.upload);
  const dnValues  = history.map((p) => p.download);
  const upBars    = buildBars(upValues, 8, 28);
  const dnBars    = buildBars(dnValues, 8, 28);

  const handleDrag = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await getCurrentWindow().startDragging();
    } catch {}
  };

  return (
    <div className="cw-root" role="status">

      {/* ── Header ── */}
      <div className="cw-header">
        <span className="cw-brand">FluxNet</span>
        <div
          className="cw-drag-handle"
          onMouseDown={handleDrag}
          title="Drag to move"
          aria-hidden="true"
        />
      </div>

      {/* ── Speed rows ── */}
      <div className="cw-speeds">
        <div className="cw-speed-row">
          <span className="cw-num">{up.value}</span>
          <span className="cw-unit">{up.unit}</span>
        </div>
        <div className="cw-speed-row">
          <span className="cw-num">{dn.value}</span>
          <span className="cw-unit">{dn.unit}</span>
        </div>
      </div>

      {/* ── Interface + interval row ── */}
      <div className="cw-meta-row">
        <span className="cw-iface-pill">
          <span className={`cw-live-dot ${isConnected ? "live" : "dead"}`} />
          {data.interfaceName || "—"}
        </span>
        <span className="cw-interval">1s</span>
      </div>

      {/* ── Mini bar chart ── */}
      <div className="cw-chart">
        {/* Upload bars — green, left group */}
        <div className="cw-bar-group">
          {upBars.map((h, i) => (
            <div key={i} className="cw-bar up" style={{ height: `${h}px` }} />
          ))}
        </div>

        {/* Gap between groups */}
        <div className="cw-bar-gap" />

        {/* Download bars — blue, right group */}
        <div className="cw-bar-group">
          {dnBars.map((h, i) => (
            <div key={i} className="cw-bar dn" style={{ height: `${h}px` }} />
          ))}
        </div>
      </div>

    </div>
  );
}