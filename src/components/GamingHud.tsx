import { usePingPoller, useKeyboardNudge, useDragToMove } from "@/hooks";
import { useNetworkStore, usePingStore, useSettingsStore } from "@/store";
import { formatSpeed } from "@/utils";
import { HudPresentation } from "./HudPresentation";

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
      role="status"
      tabIndex={0}
      aria-label={`Ping ${stats.latencyMs ?? "unknown"} ms, Download ${dn.value} ${dn.unit}, Upload ${up.value} ${up.unit}, Packet loss ${stats.lossPercent.toFixed(0)} percent`}
      className="w-full h-full focus-visible:outline-2 focus-visible:outline-(--hud-amber) focus-visible:outline-offset-2"
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
