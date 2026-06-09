import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WIDGET_REGISTRY, WidgetLabel } from "@/config";
import { applyColorMode } from "@/utils";
import { getStorageItem } from "@/utils";

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

    // Listen for storage changes from other windows (native cross-window StorageEvent)
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
