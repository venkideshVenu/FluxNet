import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useDragToMove() {
  return useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await getCurrentWindow().startDragging();
    } catch (err) {
      console.error("Failed to start dragging:", err);
    }
  }, []);
}
