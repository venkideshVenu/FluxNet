import { useEffect, useRef, useState } from "react";
import {
  invoke,
  listen,
  WIDGET_VISIBILITY_EVENT,
  type UnlistenFn,
  type WidgetVisibilityPayload,
} from "@/api";
import { ColorMode, setStorageWithNotify } from "@/utils";
import { WidgetRegistryEntry } from "@/config";

/**
 * Manages all local state and side effects for a single widget config panel.
 */
export function useWidgetPanelState(config: WidgetRegistryEntry) {
  const [visible, setVisible] = useState<boolean | null>(null);

  // Fix: Use stored value with proper default from registry
  const [alwaysOnTop, setAlwaysOnTop] = useState(() => {
    const stored = localStorage.getItem(config.alwaysOnTopKey);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return config.defaultAlwaysOnTop; // Use registry default
  });

  const [opacity, setOpacity] = useState(() => {
    const saved = Number(localStorage.getItem(config.opacityKey) ?? NaN);
    return Number.isFinite(saved) && saved > 0 ? saved : config.defaultOpacity;
  });
  const [colorMode, setColorMode] = useState<ColorMode>(config.getStoredMode());
  const [intervalMs, setIntervalMs] = useState(config.getStoredInterval());

  const togglingRef = useRef(false);

  // Widget windows are created and destroyed on demand, so read the persisted
  // visibility from the backend and follow its change events (tray toggles,
  // Alt+F4 on a widget, other panels) instead of probing the window.
  useEffect(() => {
    let alive = true;
    let eventSeen = false;
    let unlisten: UnlistenFn | undefined;

    listen<WidgetVisibilityPayload>(WIDGET_VISIBILITY_EVENT, (event) => {
      if (event.payload?.label !== config.label) return;
      eventSeen = true;
      setVisible(Boolean(event.payload.visible));
    })
      .then((fn) => {
        if (alive) unlisten = fn;
        else fn();
      })
      .catch((err) => console.error("Visibility listener failed:", err));

    invoke<boolean>("get_widget_visibility", { label: config.label })
      .then((value) => {
        // A change event is newer than this initial read.
        if (alive && !eventSeen) setVisible(Boolean(value));
      })
      .catch((err) => {
        console.error("get_widget_visibility failed:", err);
        if (alive && !eventSeen) setVisible(false);
      });

    return () => {
      alive = false;
      unlisten?.();
    };
  }, [config.label]);

  const toggleVisible = async () => {
    if (visible === null || togglingRef.current) return;
    const previous = visible;
    const next = !previous;
    togglingRef.current = true;
    setVisible(next);
    try {
      await invoke("set_widget_visibility", {
        label: config.label,
        visible: next,
      });
    } catch (err) {
      console.error("set_widget_visibility failed:", err);
      setVisible(previous);
    } finally {
      togglingRef.current = false;
    }
  };

  const handleAlwaysOnTop = async (value: boolean) => {
    setAlwaysOnTop(value);
    setStorageWithNotify(config.alwaysOnTopKey, String(value));
    await invoke("set_widget_always_on_top", { label: config.label, value });
  };

  const handleOpacityChange = (value: number) => {
    setOpacity(value);
  };

  const handleOpacityCommit = async (value: number) => {
    setStorageWithNotify(config.opacityKey, String(value));
    await invoke("set_widget_opacity", {
      label: config.label,
      value: value / 100,
    });
  };

  const handleColorMode = (mode: ColorMode) => {
    setColorMode(mode);
    setStorageWithNotify(config.modeKey, mode);
  };

  const handleInterval = (raw: string) => {
    const ms = parseFloat(raw) * 1000;
    setIntervalMs(ms);
    setStorageWithNotify(config.intervalKey, String(ms));
  };

  return {
    visible,
    alwaysOnTop,
    opacity,
    colorMode,
    intervalMs,
    toggleVisible,
    handleAlwaysOnTop,
    handleOpacityChange,
    handleOpacityCommit,
    handleColorMode,
    handleInterval,
  };
}
