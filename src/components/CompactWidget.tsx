import { fetchUsageStats } from "@/api/storageApi";
import { useNetworkStore } from "@/store";
import { getStoredCompactIntervalMs, LS_COMPACT_INTERVAL } from "@/utils";
import { formatBytes, formatSpeed } from "@/utils/formatSpeed";
import { useEffect, useState } from "react";
import { CompactPresentation } from "./CompactPresentation";
import { useDragToMove } from "@/hooks/useDragToMove";

export function CompactWidget() {
  const { data, isConnected, todayDownloadBytes, todayUploadBytes } =
    useNetworkStore();
  const [intervalMs, setIntervalMs] = useState(getStoredCompactIntervalMs);
  const [dbStats, setDbStats] = useState<{ dl: number; ul: number } | null>(
    null,
  );

  const up = formatSpeed(data.uploadBytesPerSec);
  const dn = formatSpeed(data.downloadBytesPerSec);
  const upToday = formatBytes(dbStats?.ul ?? todayUploadBytes);
  const dnToday = formatBytes(dbStats?.dl ?? todayDownloadBytes);
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
        // FIX: Issue 14.1 — Log errors instead of silently swallowing
        console.error("CompactWidget: fetchUsageStats failed:", err);
      }
    };
    syncTodayTotals();
    const id = setInterval(syncTodayTotals, 30_000);
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
        downloadValue={dn.value}
        downloadUnit={dn.unit}
        uploadValue={up.value}
        uploadUnit={up.unit}
        todayDownloadValue={dnToday.value}
        todayDownloadUnit={dnToday.unit}
        todayUploadValue={upToday.value}
        todayUploadUnit={upToday.unit}
      />
    </div>
  );
}