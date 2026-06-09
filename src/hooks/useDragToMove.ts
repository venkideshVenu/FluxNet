import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const currentWindow = getCurrentWindow();

export function useDragToMove() {
  return useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await currentWindow.startDragging();
    } catch (err) {
      console.error("Failed to start dragging:", err);
    }
  }, []);
}
