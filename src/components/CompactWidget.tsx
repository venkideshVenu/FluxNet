import { fetchUsageStats } from "@/api";
import { useShallow } from "zustand/react/shallow";
import { useNetworkStore, useSettingsStore } from "@/store";
import {
  getStoredCompactIntervalMs,
  LS_COMPACT_INTERVAL,
  formatBytes,
  formatSpeed,
} from "@/utils";
import { useEffect, useState } from "react";
import { CompactPresentation } from "./CompactPresentation";
import { useDragFromHandle, useFitWindow, useKeyboardNudge } from "@/hooks";

export function CompactWidget() {
  const { data, isConnected } = useNetworkStore(
    useShallow((s) => ({ data: s.data, isConnected: s.isConnected })),
  );
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const [intervalMs, setIntervalMs] = useState(getStoredCompactIntervalMs);
  const [dbStats, setDbStats] = useState<{ dl: number; ul: number } | null>(
    null,
  );

  const up = formatSpeed(data.uploadBytesPerSec, displayUnits);
  const dn = formatSpeed(data.downloadBytesPerSec, displayUnits);
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
    const id = setInterval(syncTodayTotals, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const handleDrag = useDragFromHandle();
  const fitRef = useFitWindow<HTMLDivElement>();
  const handleKeyNudge = useKeyboardNudge();

  return (
    <div
      ref={fitRef}
      onMouseDown={handleDrag}
      onKeyDown={handleKeyNudge}
      role="status"
      tabIndex={0}
      className="w-max p-px focus-visible:outline-2 focus-visible:outline-(--w-fg) focus-visible:outline-offset-[3px] focus-visible:rounded-xl"
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
