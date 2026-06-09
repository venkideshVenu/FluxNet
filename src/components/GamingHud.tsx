import { usePingPoller } from "@/hooks";
import { useNetworkStore, usePingStore } from "@/store";
import { formatSpeed } from "@/utils";
import { HudPresentation } from "./HudPresentation";
import { useDragToMove } from "@/hooks";

export function GamingHud() {
  usePingPoller(2000);
  const { data } = useNetworkStore();
  const { stats } = usePingStore();
  const up = formatSpeed(data.uploadBytesPerSec);
  const dn = formatSpeed(data.downloadBytesPerSec);

  const handleDrag = useDragToMove();

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
