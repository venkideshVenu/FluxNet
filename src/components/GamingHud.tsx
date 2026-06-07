import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNetworkStore } from "../store/networkStore";
import { usePingStore } from "../store/pingStore";
import { usePingPoller } from "../hooks/usePingPoller";
import { formatSpeed } from "../utils/formatSpeed";
import { HudPresentation } from "./HudPresentation";

export function GamingHud() {
  usePingPoller(2000);
  const { data } = useNetworkStore();
  const { stats } = usePingStore();
  const up = formatSpeed(data.uploadBytesPerSec);
  const dn = formatSpeed(data.downloadBytesPerSec);

  const handleDrag = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await getCurrentWindow().startDragging();
    } catch {}
  };

  return (
    <div onMouseDown={handleDrag}>
      <HudPresentation
        downloadValue={dn.value}
        downloadUnit={dn.unit}
        uploadValue={up.value}
        uploadUnit={up.unit}
        latencyMs={stats.latencyMs}
        lossPercent={stats.lossPercent}
      />
    </div>
  );
}
