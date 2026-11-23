import { useEffect, useRef } from "react";
import { invoke } from "@/api";

/**
 * Converts a measured CSS size to physical (screen) pixels. `scale` is
 * `devicePixelRatio`: display scaling, zoom and text size combined.
 */
export function toPhysicalSize(
  width: number,
  height: number,
  scale: number,
): { physicalWidth: number; physicalHeight: number } {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return {
    physicalWidth: Math.ceil(width * s),
    physicalHeight: Math.ceil(height * s),
  };
}

/**
 * Sizes the widget's window to the element the returned ref is attached to.
 *
 * Text width depends on the installed fonts and Windows' text settings, so a
 * fixed window size either clips the widget or leaves an invisible margin
 * around it that still catches clicks. The element is measured whenever its
 * size or the screen scale changes, and the backend resizes the window to
 * match. Sizes are sent in physical pixels, so the window and the page can't
 * disagree about scaling (they do when Windows' text size is enlarged).
 */
export function useFitWindow<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let lastSize = "";
    let frame = 0;

    const report = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const size = toPhysicalSize(
        rect.width,
        rect.height,
        window.devicePixelRatio,
      );
      const key = `${size.physicalWidth}x${size.physicalHeight}`;
      if (key === lastSize) return;
      lastSize = key;
      invoke("fit_widget_window", size).catch(console.error);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(report);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    void document.fonts?.ready.then(schedule);

    // The CSS size stays the same when the scale changes (another monitor,
    // Windows display scaling or text size), but the physical size doesn't.
    let scaleQuery: MediaQueryList | undefined;
    const onScaleChange = () => {
      watchScale();
      schedule();
    };
    const watchScale = () => {
      scaleQuery?.removeEventListener("change", onScaleChange);
      scaleQuery = window.matchMedia?.(
        `(resolution: ${window.devicePixelRatio}dppx)`,
      );
      scaleQuery?.addEventListener("change", onScaleChange);
    };
    watchScale();

    return () => {
      observer.disconnect();
      scaleQuery?.removeEventListener("change", onScaleChange);
      cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}
