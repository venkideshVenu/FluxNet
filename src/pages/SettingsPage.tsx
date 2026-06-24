import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore, DisplayUnits, useNetworkStore } from "@/store";
import type {
  TimeFormat,
  DateFormat,
  StartOfWeek,
} from "@/store";
import {
  THEMES,
  applyAccent,
  applyColorMode,
  getStoredAccentIndex,
  getStoredColorMode,
  ColorMode,
  setStorageItem,
  getFilteredThemes,
  resolveColorMode,
} from "@/utils";
import { FluxSelect, useToast } from "@/components";

export function SettingsPage() {
  const pollIntervalMs = useSettingsStore((s) => s.pollIntervalMs);
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const dateFormat = useSettingsStore((s) => s.dateFormat);
  const startOfWeek = useSettingsStore((s) => s.startOfWeek);
  const setPollInterval = useSettingsStore((s) => s.setPollInterval);
  const setDisplayUnits = useSettingsStore((s) => s.setDisplayUnits);
  const setTimeFormat = useSettingsStore((s) => s.setTimeFormat);
  const setDateFormat = useSettingsStore((s) => s.setDateFormat);
  const setStartOfWeek = useSettingsStore((s) => s.setStartOfWeek);
  const resetPeaks = useNetworkStore((s) => s.resetPeaks);
  const { showToast } = useToast();

  const [startWithOS, setStartWithOS] = useState(false);
  const [autostartAvailable, setAutostartAvailable] = useState(true);
  const [autostartError, setAutostartError] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState(getStoredAccentIndex);
  const [colorMode, setColorMode] = useState<ColorMode>(getStoredColorMode);
  const [minimizeToTray, setMinimizeToTray] = useState(true);

  useEffect(() => {
    invoke<number>("get_refresh_interval")
      .then((ms) => setPollInterval(ms))
      .catch(console.warn);
    invoke<boolean>("plugin:autostart|is_enabled")
      .then((enabled) => {
        setStartWithOS(enabled);
        setAutostartAvailable(true);
      })
      .catch((err) => {
        setStartWithOS(false);
        setAutostartAvailable(false);
        setAutostartError("Autostart plugin not available.");
        console.warn("autostart not available:", err);
      });
  }, [setPollInterval]);

  useEffect(() => {
    applyAccent(THEMES[selectedTheme]?.color ?? THEMES[0].color);
  }, [selectedTheme]);
  useEffect(() => {
    applyColorMode(colorMode);
  }, [colorMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (colorMode === "system") applyColorMode("system");
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [colorMode]);

  useEffect(() => {
    invoke<boolean>("get_minimize_to_tray")
      .then(setMinimizeToTray)
      .catch(console.warn);
  }, []);

  const handleInterval = async (raw: string) => {
    const ms = parseFloat(raw) * 1000;
    setPollInterval(ms);
    await invoke("set_refresh_interval", { intervalMs: ms }).catch(
      console.warn,
    );
  };

  const handleUnits = (raw: string) => setDisplayUnits(raw as DisplayUnits);

  const handleStartWithOS = async (value: boolean) => {
    if (!autostartAvailable) return;
    setStartWithOS(value);
    setAutostartError(null);
    try {
      if (value) await invoke("plugin:autostart|enable");
      else await invoke("plugin:autostart|disable");
    } catch (err) {
      setAutostartError("Failed to change autostart setting.");
      setStartWithOS(!value);
    }
  };

  const handleTheme = (index: number) => {
    setSelectedTheme(index);
    setStorageItem("fluxnet_accent_index", index);
  };
  const handleColorMode = (mode: ColorMode) => {
    setColorMode(mode);
    setStorageItem("fluxnet_color_mode", mode);
  };
  const handleResetPeaks = () => {
    resetPeaks();
    invoke("reset_peaks").catch(console.warn);
    showToast("Session peaks have been reset", "success");
  };
  const handleMinimizeToTray = async (value: boolean) => {
    setMinimizeToTray(value);
    await invoke("set_minimize_to_tray", { enabled: value }).catch(
      console.warn,
    );
  };

  const effectiveTheme = resolveColorMode(colorMode);
  const filteredThemes = getFilteredThemes(effectiveTheme);

  return (
    <div className="p-7 px-8 w-full max-w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[22px] font-semibold text-text tracking-[-0.02em] leading-none mb-1.25">
            Settings
          </div>
          <div className="text-[12px] text-text-muted font-normal">
            Customize FluxNet behavior and appearance
          </div>
        </div>
      </div>

      {/* Monitoring */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-accent uppercase tracking-[0.08em] mb-3">
          Monitoring
        </div>
        <div className="bg-panel border border-border rounded-lg">
          <div className="flex items-center justify-between px-4.5 py-3.25 border-b border-accent-soft-2">
            <div>
              <div className="text-[13px] text-text font-[450]">
                Dashboard refresh interval
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                How often the dashboard UI updates
              </div>
            </div>
            <FluxSelect
              value={String(pollIntervalMs / 1000)}
              onChange={handleInterval}
              options={[
                { value: "0.5", label: "0.5 seconds" },
                { value: "1", label: "1 second" },
                { value: "2", label: "2 seconds" },
                { value: "5", label: "5 seconds" },
              ]}
            />
          </div>
          <div className="flex items-center justify-between px-4.5 py-3.25">
            <div>
              <div className="text-[13px] text-text font-[450]">
                Display units
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                {displayUnits === "bytes"
                  ? "Bytes per second (B/s, KB/s, MB/s, GB/s)"
                  : "Bits per second (bps, Kbps, Mbps, Gbps)"}
              </div>
            </div>
            <FluxSelect
              value={displayUnits}
              onChange={handleUnits}
              width="w-[220px]"
              options={[
                { value: "bytes", label: "Bytes/s (KB/s, MB/s, GB/s)" },
                { value: "bits", label: "Bits/s (Kbps, Mbps, Gbps)" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Time & Date */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-accent uppercase tracking-[0.08em] mb-3">
          Time & Date
        </div>
        <div className="bg-panel border border-border rounded-lg">
          <div className="flex items-center justify-between px-4.5 py-3.25 border-b border-accent-soft-2">
            <div>
              <div className="text-[13px] text-text font-[450]">
                Time format
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Used across all views and charts
              </div>
            </div>
            <FluxSelect
              value={timeFormat}
              onChange={(v) => setTimeFormat(v as TimeFormat)}
              options={[
                { value: "12h", label: "12-hour (1:30 PM)" },
                { value: "24h", label: "24-hour (13:30)" },
              ]}
            />
          </div>
          <div className="flex items-center justify-between px-4.5 py-3.25 border-b border-accent-soft-2">
            <div>
              <div className="text-[13px] text-text font-[450]">
                Date format
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Used for history and tooltips
              </div>
            </div>
            <FluxSelect
              value={dateFormat}
              onChange={(v) => setDateFormat(v as DateFormat)}
              options={[
                { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
                { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
                { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
              ]}
            />
          </div>
          <div className="flex items-center justify-between px-4.5 py-3.25">
            <div>
              <div className="text-[13px] text-text font-[450]">
                Start of week
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Affects weekly history view
              </div>
            </div>
            <FluxSelect
              value={startOfWeek}
              onChange={(v) => setStartOfWeek(v as StartOfWeek)}
              options={[
                { value: "sunday", label: "Sunday" },
                { value: "monday", label: "Monday" },
                { value: "saturday", label: "Saturday" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-accent uppercase tracking-[0.08em] mb-3">
          Appearance
        </div>
        <div className="bg-panel border border-border rounded-lg">
          <div className="flex items-center justify-between px-4.5 py-3.25 border-b border-accent-soft-2">
            <div>
              <div className="text-[13px] text-text font-[450]">Theme mode</div>
              <div className="text-[11px] text-text-muted mt-0.5">
                {colorMode === "system"
                  ? "Follows Windows personalization"
                  : colorMode === "dark"
                    ? "Always dark"
                    : "Always light"}
              </div>
            </div>
            <FluxSelect
              value={colorMode}
              onChange={(v) => handleColorMode(v as ColorMode)}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </div>
          <div className="flex flex-col items-start gap-3 px-4.5 py-3.25">
            <div className="text-[13px] text-text font-[450]">
              Accent colour
            </div>
            <div
              className="flex gap-2 flex-wrap"
              role="radiogroup"
              aria-label="Accent colour"
            >
              {filteredThemes.map((t) => {
                const globalIndex = THEMES.indexOf(t);
                const isWhite = t.color === "#FFFFFF";
                return (
                  <button
                    key={globalIndex}
                    type="button"
                    className={`w-6.5 h-6.5 rounded-full cursor-pointer p-0 transition-transform hover:scale-[1.15] ${selectedTheme === globalIndex ? "ring-2 ring-accent ring-offset-2 ring-offset-panel" : ""}`}
                    style={{
                      background: t.color,
                      border: isWhite
                        ? "1.5px solid var(--border-strong)"
                        : "none",
                    }}
                    title={t.label}
                    aria-label={`${t.label} theme`}
                    aria-pressed={selectedTheme === globalIndex}
                    onClick={() => handleTheme(globalIndex)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* App behavior */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-accent uppercase tracking-[0.08em] mb-3">
          App behavior
        </div>
        <div className="bg-panel border border-border rounded-lg">
          <div className="flex items-center justify-between px-4.5 py-3.25 border-b border-accent-soft-2">
            <div>
              <div className="text-[13px] text-text font-[450]">
                Run in background
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Keep FluxNet running in system tray when dashboard is closed
              </div>
            </div>
            <div
              className={`w-9.5 h-5.25 rounded-[11px] flex items-center p-0.5 cursor-pointer transition-colors ${minimizeToTray ? "bg-accent" : "bg-accent-muted"}`}
              onClick={() => handleMinimizeToTray(!minimizeToTray)}
              role="switch"
              aria-checked={minimizeToTray}
            >
              <div
                className={`w-4.25 h-4.25 rounded-full bg-toggle-knob transition-transform ${minimizeToTray ? "translate-x-4.25" : "translate-x-0"}`}
              />
            </div>
          </div>
          <div className="flex items-center justify-between px-4.5 py-3.25">
            <div>
              <div className="text-[13px] text-text font-[450]">
                Start with Windows
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Launch FluxNet at login
                {autostartError && (
                  <span className="block text-danger-text text-[11px] mt-1">
                    {autostartError}
                  </span>
                )}
              </div>
            </div>
            <div
              className={`w-9.5 h-5.25 rounded-[11px] flex items-center p-0.5 cursor-pointer transition-colors shrink-0 ${startWithOS ? "bg-accent" : "bg-accent-muted"} ${!autostartAvailable ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
              onClick={() => handleStartWithOS(!startWithOS)}
              role="switch"
              aria-checked={startWithOS}
            >
              <div
                className={`w-4.25 h-4.25 rounded-full bg-toggle-knob transition-transform shadow-[0_1px_3px_rgba(0,0,0,0.15)] ${startWithOS ? "translate-x-4.25" : "translate-x-0"}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Data */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-accent uppercase tracking-[0.08em] mb-3">
          Data
        </div>
        <div className="bg-panel border border-border rounded-lg">
          <div className="flex items-center justify-between px-4.5 py-3.25">
            <div>
              <div className="text-[13px] text-text font-[450]">
                Reset session peaks
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Clear peak upload/download for this session
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetPeaks}
              className="bg-danger-bg text-danger-text border border-danger-border rounded-[7px] px-3 py-1.25 text-[12px] cursor-pointer font-sans transition-opacity hover:opacity-85"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
