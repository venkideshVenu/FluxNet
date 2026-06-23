import { useEffect } from "react";
import { invoke } from "@/api";
import { WIDGET_REGISTRY, WidgetLabel } from "@/config";
import { applyColorMode } from "@/utils";

/**
 * Applies initial widget settings and listens for live changes.
 */
export function useWidgetSettings(label: WidgetLabel) {
  useEffect(() => {
    const config = WIDGET_REGISTRY[label];
    if (!config) return;

    // Apply initial color mode
    applyColorMode(config.getStoredMode());

    // Always-on-top: ensure localStorage has a value, then apply
    const storedAOT = localStorage.getItem(config.alwaysOnTopKey);
    let aot: boolean;
    if (storedAOT === null) {
      // First launch: write default to localStorage
      aot = config.defaultAlwaysOnTop;
      localStorage.setItem(config.alwaysOnTopKey, String(aot));
    } else {
      aot = storedAOT === "true";
    }

    // Small delay to ensure window is fully ready before setting always-on-top
    const aotTimer = setTimeout(() => {
      invoke("set_widget_always_on_top", {
        label,
        value: aot,
      }).catch(console.error);
    }, 300);

    // Opacity: ensure localStorage has a value, then apply
    const storedOpacity = localStorage.getItem(config.opacityKey);
    let opacityValue: number;
    if (storedOpacity === null) {
      opacityValue = config.defaultOpacity;
      localStorage.setItem(config.opacityKey, String(opacityValue));
    } else {
      opacityValue = Number(storedOpacity);
      if (!Number.isFinite(opacityValue)) opacityValue = config.defaultOpacity;
    }

    const opacityTimer = setTimeout(() => {
      invoke("set_widget_opacity", {
        label,
        value: opacityValue / 100,
      }).catch(console.error);
    }, 350);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === config.alwaysOnTopKey && event.newValue !== null) {
        invoke("set_widget_always_on_top", {
          label,
          value: event.newValue === "true",
        }).catch(console.error);
      } else if (event.key === config.opacityKey && event.newValue !== null) {
        const next = Number(event.newValue) / 100;
        if (Number.isFinite(next)) {
          invoke("set_widget_opacity", { label, value: next }).catch(
            console.error,
          );
        }
      } else if (event.key === config.modeKey && event.newValue !== null) {
        const mode = event.newValue;
        if (mode === "light" || mode === "dark" || mode === "system") {
          applyColorMode(mode);
        }
      }
    };

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      const currentMode = config.getStoredMode();
      if (currentMode === "system") {
        applyColorMode("system");
      }
    };

    window.addEventListener("storage", handleStorage);
    mediaQuery.addEventListener("change", handleSystemChange);

    return () => {
      clearTimeout(aotTimer);
      clearTimeout(opacityTimer);
      window.removeEventListener("storage", handleStorage);
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, [label]);
}
