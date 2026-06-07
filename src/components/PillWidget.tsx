import { useNetworkStore } from "@/store";
import { formatSpeed } from "@/utils/formatSpeed";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PillPresentation } from "./PillPresentation";

export function PillWidget() {
  const { data, isConnected } = useNetworkStore();
  const up = formatSpeed(data.uploadBytesPerSec);
  const dn = formatSpeed(data.downloadBytesPerSec);

  const handleDragStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await getCurrentWindow().startDragging();
    } catch {}
  };

  return (
    <div
      onMouseDown={handleDragStart}
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
