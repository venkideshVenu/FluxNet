import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WIDGET_REGISTRY, WidgetLabel } from "@/config/widgetRegistry";
import { applyColorMode } from "@/utils/theme";
import { getStorageItem } from "@/utils/storage";

/**
 * Applies initial widget settings (color mode, opacity, always-on-top)
 * and listens for live changes via storage events from the Dashboard window.
 *
 * FIX: Issue 2.4 — Now reads from WIDGET_REGISTRY instead of 5 manual lookup tables
 * FIX: Issue 2.3 — Uses typed getStorageItem instead of raw localStorage
 */
export function useWidgetSettings(label: WidgetLabel) {
  useEffect(() => {
    const config = WIDGET_REGISTRY[label];
    if (!config) return;

    // Apply initial color mode
    applyColorMode(config.getStoredMode());

    // Apply initial always-on-top
    invoke("set_widget_always_on_top", {
      label,
      value: config.getStoredAlwaysOnTop(),
    }).catch(console.error);

    // Apply initial opacity
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

    // Listen for storage changes from other windows (e.g., WidgetSettingsPage)
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
        if (event.newValue === "light" || event.newValue === "dark") {
          applyColorMode(event.newValue);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [label]);
}
