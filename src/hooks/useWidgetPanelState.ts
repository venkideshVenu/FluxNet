import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ColorMode } from "@/utils";
import { WidgetRegistryEntry } from "@/config";

export function useWidgetPanelState(config: WidgetRegistryEntry) {
  const [visible, setVisible] = useState<boolean | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = useState(config.getStoredAlwaysOnTop());
  const [opacity, setOpacity] = useState(() => {
    const saved = localStorage.getItem(config.opacityKey);
    return saved ? Number(saved) : config.defaultOpacity;
  });
  const [colorMode, setColorMode] = useState<ColorMode>(config.getStoredMode());
  const [intervalMs, setIntervalMs] = useState(config.getStoredInterval());

  useEffect(() => {
    WebviewWindow.getByLabel(config.label).then((win) => {
      if (win) {
        win.isVisible().then(setVisible);
      } else {
        setVisible(false);
      }
    });
  }, [config.label]);

  const toggleVisible = async () => {
    const next = !visible;
    setVisible(next);
    await invoke("set_widget_visibility", {
      label: config.label,
      visible: next,
    });
  };

  const handleAlwaysOnTop = async (value: boolean) => {
    setAlwaysOnTop(value);
    localStorage.setItem(config.alwaysOnTopKey, String(value));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: config.alwaysOnTopKey,
        newValue: String(value),
      }),
    );
    await invoke("set_widget_always_on_top", { label: config.label, value });
  };

  const handleOpacityChange = (value: number) => {
    setOpacity(value);
  };

  const handleOpacityCommit = async (value: number) => {
    localStorage.setItem(config.opacityKey, String(value));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: config.opacityKey,
        newValue: String(value),
      }),
    );
    await invoke("set_widget_opacity", {
      label: config.label,
      value: value / 100,
    });
  };

  const handleColorMode = (mode: ColorMode) => {
    setColorMode(mode);
    localStorage.setItem(config.modeKey, mode);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: config.modeKey,
        newValue: mode,
      }),
    );
  };

  const handleInterval = (raw: string) => {
    const ms = parseFloat(raw) * 1000;
    setIntervalMs(ms);
    localStorage.setItem(config.intervalKey, String(ms));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: config.intervalKey,
        newValue: String(ms),
      }),
    );
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
