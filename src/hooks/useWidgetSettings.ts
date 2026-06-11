import { useEffect } from "react";
import { invoke } from "@/api/tauri";
import { WIDGET_REGISTRY, WidgetLabel } from "@/config/widgetRegistry";
import { applyColorMode } from "@/utils/theme";
import { getStorageItem } from "@/utils/storage";

/**
 * Applies initial widget settings and listens for live changes.
 */
export function useWidgetSettings(label: WidgetLabel) {
  useEffect(() => {
    const config = WIDGET_REGISTRY[label];
    if (!config) return;

    // Apply initial color mode
    applyColorMode(config.getStoredMode());

    invoke("set_widget_always_on_top", {
      label,
      value: config.getStoredAlwaysOnTop(),
    }).catch(console.error);

    const opacity =
      Number(
        getStorageItem(
          config.opacityKey as keyof import("@/utils").StorageSchema,
          config.defaultOpacity,
        ),
      ) / 100;
    invoke("set_widget_opacity", { label, value: opacity }).catch(
      console.error,
    );

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

    // Listen for OS theme changes when widget is in "system" mode
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
      window.removeEventListener("storage", handleStorage);
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, [label]);
}
