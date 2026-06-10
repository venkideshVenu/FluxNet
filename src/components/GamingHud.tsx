import { usePingPoller } from "@/hooks";
import { useNetworkStore, usePingStore, useSettingsStore } from "@/store";
import { formatSpeed } from "@/utils";
import { HudPresentation } from "./HudPresentation";
import { useDragToMove, useKeyboardNudge } from "@/hooks/useDragToMove";

export function GamingHud() {
  usePingPoller(2000);
  const { data } = useNetworkStore();
  const { stats } = usePingStore();
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const up = formatSpeed(data.uploadBytesPerSec, displayUnits);
  const dn = formatSpeed(data.downloadBytesPerSec, displayUnits);

  const handleDrag = useDragToMove();
  const handleKeyNudge = useKeyboardNudge();

  return (
    <div
      onMouseDown={handleDrag}
      onKeyDown={handleKeyNudge}
      tabIndex={0}
      title="Drag to move · Arrow keys to nudge"
    >
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
