import { fetchUsageStats } from "@/api/storageApi";
import { useNetworkStore } from "@/store";
import { getStoredCompactIntervalMs, LS_COMPACT_INTERVAL } from "@/utils";
import { formatBytes, formatSpeed } from "@/utils";
import { useEffect, useState } from "react";
import { CompactPresentation } from "./CompactPresentation";
import { useDragToMove } from "@/hooks";

export function CompactWidget() {
  const { data, isConnected } = useNetworkStore();
  const [intervalMs, setIntervalMs] = useState(getStoredCompactIntervalMs);
  const [dbStats, setDbStats] = useState<{ dl: number; ul: number } | null>(
    null,
  );

  const up = formatSpeed(data.uploadBytesPerSec);
  const dn = formatSpeed(data.downloadBytesPerSec);

  // Show "—" until DB responds rather than showing a speculative in-memory estimate
  // that diverges from the authoritative value and causes visible jumps.
  const upToday = dbStats ? formatBytes(dbStats.ul) : { value: "—", unit: "" };
  const dnToday = dbStats ? formatBytes(dbStats.dl) : { value: "—", unit: "" };
  const intervalLabel = `${intervalMs / 1000}s`;

  useEffect(() => {
    const sync = () => setIntervalMs(getStoredCompactIntervalMs());
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_COMPACT_INTERVAL) sync();
    };
    sync();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Poll DB every 10s (more frequent than before) to reduce staleness without
  // needing a separate in-memory counter.
  useEffect(() => {
    let alive = true;
    const syncTodayTotals = async () => {
      try {
        const stats = await fetchUsageStats();
        if (alive)
          setDbStats({
            dl: stats.todayDownloadBytes,
            ul: stats.todayUploadBytes,
          });
      } catch (err) {
        console.error("CompactWidget: fetchUsageStats failed:", err);
      }
    };
    syncTodayTotals();
    const id = setInterval(syncTodayTotals, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const handleDrag = useDragToMove();

  return (
    <div onMouseDown={handleDrag} role="status">
      <CompactPresentation
        interfaceName={data.interfaceName}
        isConnected={isConnected}
        intervalLabel={intervalLabel}
        download={dn}
        upload={up}
        todayDownload={dnToday}
        todayUpload={upToday}
      />
    </div>
  );
}
