import { useCallback } from "react";
import {
  startDragging,
  getWindowPosition,
  setWindowPosition,
} from "@/api/tauri";

/** Pixel amount to move on each arrow key press */
const NUDGE_AMOUNT = 10;

/**
 * Returns a mouse handler for Tauri window dragging.
 */
export function useDragToMove() {
  return useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    await startDragging();
  }, []);
}

/**
 * Keyboard-based position nudge handler for accessibility.
 *
 * Arrow keys move window by NUDGE_AMOUNT. Hold Shift for 5x speed.
 */
export function useKeyboardNudge() {
  return useCallback(async (e: React.KeyboardEvent) => {
    const multiplier = e.shiftKey ? 5 : 1;
    const amount = NUDGE_AMOUNT * multiplier;

    let dx = 0;
    let dy = 0;

    switch (e.key) {
      case "ArrowLeft":
        dx = -amount;
        break;
      case "ArrowRight":
        dx = amount;
        break;
      case "ArrowUp":
        dy = -amount;
        break;
      case "ArrowDown":
        dy = amount;
        break;
      default:
        return;
    }

    e.preventDefault();

    try {
      const pos = await getWindowPosition();
      await setWindowPosition(pos.x + dx, pos.y + dy);
    } catch {
      // Position adjustment not supported or failed — acceptable
    }
  }, []);
}
