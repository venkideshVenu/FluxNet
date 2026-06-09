import { fetchUsageStats } from "@/api/storageApi";
import { useNetworkStore } from "@/store";
import { getStoredCompactIntervalMs, LS_COMPACT_INTERVAL } from "@/utils";
import { formatBytes, formatSpeed } from "@/utils/formatSpeed";
import { useEffect, useState } from "react";
import { CompactPresentation } from "./CompactPresentation";
import { useDragToMove, useKeyboardNudge } from "@/hooks/useDragToMove";

export function CompactWidget() {
  const { data, isConnected } = useNetworkStore();
  const [intervalMs, setIntervalMs] = useState(getStoredCompactIntervalMs);
  const [dbStats, setDbStats] = useState<{ dl: number; ul: number } | null>(
    null,
  );

  const up = formatSpeed(data.uploadBytesPerSec);
  const dn = formatSpeed(data.downloadBytesPerSec);
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

  /**
   *
   * The `alive` flag prevents calling `setDbStats` after the component unmounts.
   * This handles the race condition where:
   * 1. setInterval fires `syncTodayTotals`
   * 2. `fetchUsageStats()` starts an async IPC call
   * 3. Component unmounts (cleanup sets alive = false, clears interval)
   * 4. The IPC response arrives → `if (alive)` prevents the stale setState
   *
   * In React StrictMode (dev only), components mount → unmount → remount.
   * This could briefly cause two intervals, but the first cleanup fires immediately,
   * so at most one extra fetch occurs (which is idempotent). This is acceptable.
   */
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
  const handleKeyNudge = useKeyboardNudge();

  return (
    <div
      onMouseDown={handleDrag}
      onKeyDown={handleKeyNudge}
      role="status"
      tabIndex={0}
      title="Drag to move · Arrow keys to nudge"
    >
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
