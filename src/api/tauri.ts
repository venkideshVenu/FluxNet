/**
 * Tauri API abstraction layer.
 *
 * This provides:
 * 1. A single mock target for tests (mock `@/api/tauri` instead of 3+ packages)
 * 2. A future abstraction point for macOS differences
 * 3. Testability in jsdom (CI without Tauri runtime)
 *
 * Components and hooks should import from here, NOT directly from @tauri-apps/api/*.
 * The only exception is `main.tsx` which needs getCurrentWindow() before React mounts.
 */

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import {
  PhysicalPosition,
  getCurrentWindow as tauriGetCurrentWindow,
  type Window as TauriWindow,
} from "@tauri-apps/api/window";
import { WebviewWindow as TauriWebviewWindow } from "@tauri-apps/api/webviewWindow";

// Re-export with consistent naming
export const invoke = tauriInvoke;
export const getCurrentWindow = tauriGetCurrentWindow;
export const WebviewWindow = TauriWebviewWindow;
export type { TauriWindow };

/**
 * Get the window label for the current window.
 * Cached at module level since it never changes.
 */
export const WINDOW_LABEL: string = tauriGetCurrentWindow().label;

/**
 * Start window dragging (for widget overlays).
 * Wraps the Tauri API with error handling.
 */
export async function startDragging(): Promise<void> {
  try {
    await tauriGetCurrentWindow().startDragging();
  } catch (err) {
    console.error("Failed to start dragging:", err);
  }
}

/**
 * Get the outer position of the current window.
 */
export async function getWindowPosition(): Promise<{ x: number; y: number }> {
  const pos = await tauriGetCurrentWindow().outerPosition();
  return { x: pos.x, y: pos.y };
}

/**
 * Set the position of the current window.
 */
export async function setWindowPosition(x: number, y: number): Promise<void> {
  await tauriGetCurrentWindow().setPosition(new PhysicalPosition(x, y));
}
