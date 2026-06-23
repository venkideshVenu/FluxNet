import { useNetworkStore, useSettingsStore } from "@/store";
import { formatSpeed } from "@/utils";
import { useDragToMove, useKeyboardNudge } from "@/hooks";
import { PillPresentation } from "./PillPresentation";

export function PillWidget() {
  const { data, isConnected } = useNetworkStore();
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
      title="Drag to move · Arrow keys to nudge"
      aria-label={`Download ${dn.value} ${dn.unit}, Upload ${up.value} ${up.unit}. Use arrow keys to reposition.`}
      className="focus-visible:outline-2 focus-visible:outline-[rgba(124,111,247,0.8)] focus-visible:outline-offset-[3px] focus-visible:rounded-full"
    >
      <PillPresentation
        downloadValue={dn.value}
        downloadUnit={dn.unit}
        uploadValue={up.value}
        uploadUnit={up.unit}
        isConnected={isConnected}
        hasInterface={!!data.interfaceName}
      />
    </div>
  );
}
