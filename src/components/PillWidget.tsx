import { useNetworkStore } from "@/store";
import { formatSpeed } from "@/utils";
import { useDragToMove } from "@/hooks";
import { PillPresentation } from "./PillPresentation";

export function PillWidget() {
  const { data, isConnected } = useNetworkStore();
  const up = formatSpeed(data.uploadBytesPerSec);
  const dn = formatSpeed(data.downloadBytesPerSec);
  const handleDrag = useDragToMove();

  return (
    <div
      onMouseDown={handleDrag}
      role="status"
      title="Drag to move"
      aria-label={`Download ${dn.value} ${dn.unit}, Upload ${up.value} ${up.unit}`}
    >
      <PillPresentation
        downloadValue={dn.value}
        downloadUnit={dn.unit}
        uploadValue={up.value}
        uploadUnit={up.unit}
        isConnected={isConnected}
      />
    </div>
  );
}
