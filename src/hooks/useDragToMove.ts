import { useCallback } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";

const currentWindow = getCurrentWindow();

/** Pixel amount to move on each arrow key press */
const NUDGE_AMOUNT = 10;

/**
 * Returns handlers for mouse-based dragging and optional keyboard nudging.
 *
 * Use onMouseDown={handleDrag} for mouse dragging.
 * Use onKeyDown={handleKeyNudge} for keyboard-based position nudging.
 *
 * Keyboard controls: Arrow keys move the window by NUDGE_AMOUNT pixels.
 * Hold Shift for 5x movement speed.
 */
export function useDragToMove() {
  const handleDrag = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await currentWindow.startDragging();
    } catch (err) {
      console.error("Failed to start dragging:", err);
    }
  }, []);

  return handleDrag;
}

/**
 * Keyboard-based position nudge handler for accessibility.
 * Attach to onKeyDown on the widget container.
 *
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
        return; // Don't prevent default for other keys
    }

    e.preventDefault();

    try {
      const pos = await currentWindow.outerPosition();

      await currentWindow.setPosition(
        new PhysicalPosition(pos.x + dx, pos.y + dy),
      );
    } catch (err) {
      console.debug("Keyboard nudge failed:", err);
    }
  }, []);
}
