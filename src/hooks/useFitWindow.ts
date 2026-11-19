import { useEffect, useRef } from "react";
import { invoke } from "@/api";

/**
 * Sizes the widget's window to the element the returned ref is attached to.
 *
 * Text width depends on the installed fonts and Windows' text settings, so a
 * fixed window size either clips the widget or leaves an invisible margin
 * around it that still catches clicks. The element is measured whenever its
 * size changes (values, units, layout, fonts loading) and the backend
 * resizes the window to match.
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
      const width = Math.ceil(rect.width);
      const height = Math.ceil(rect.height);
      const size = `${width}x${height}`;
      if (width === 0 || height === 0 || size === lastSize) return;
      lastSize = size;
      invoke("fit_widget_window", { width, height }).catch(console.error);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(report);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    void document.fonts?.ready.then(schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}
