import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore, DisplayUnits } from "@/store";
import { useNetworkStore } from "@/store";
import {
  THEMES,
  applyAccent,
  applyColorMode,
  getStoredAccentIndex,
  getStoredColorMode,
  ColorMode,
  setStorageItem,
} from "@/utils";

export function SettingsPage() {
  const pollIntervalMs = useSettingsStore((s) => s.pollIntervalMs);
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const pingTarget = useSettingsStore((s) => s.pingTarget);
  const setPollInterval = useSettingsStore((s) => s.setPollInterval);
  const setDisplayUnits = useSettingsStore((s) => s.setDisplayUnits);
  const setPingTarget = useSettingsStore((s) => s.setPingTarget);
  const resetPeaks = useNetworkStore((s) => s.resetPeaks);

  const [startWithOS, setStartWithOS] = useState(false);
  const [autostartAvailable, setAutostartAvailable] = useState(true);
  const [autostartError, setAutostartError] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState(getStoredAccentIndex);
  const [colorMode, setColorMode] = useState<ColorMode>(getStoredColorMode);
  const [localPingTarget, setLocalPingTarget] = useState(pingTarget);
  const pingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    invoke<number>("get_refresh_interval")
      .then((ms) => setPollInterval(ms))
      .catch(console.warn);
    invoke<string>("get_ping_target")
      .then((target) => {
        setPingTarget(target);
        setLocalPingTarget(target);
      })
      .catch(console.warn);
    invoke<boolean>("plugin:autostart|is_enabled")
      .then((enabled) => {
        setStartWithOS(enabled);
        setAutostartAvailable(true);
      })
      .catch((err) => {
        setStartWithOS(false);
        setAutostartAvailable(false);
        setAutostartError("Autostart plugin not available. Feature disabled.");
        console.warn("autostart not available:", err);
      });
  }, [setPollInterval, setPingTarget]);

  useEffect(() => {
    setLocalPingTarget(pingTarget);
  }, [pingTarget]);
  useEffect(() => {
    applyAccent(THEMES[selectedTheme]?.color ?? THEMES[0].color);
  }, [selectedTheme]);
  useEffect(() => {
    applyColorMode(colorMode);
  }, [colorMode]);

  const handleInterval = async (raw: string) => {
    const secs = parseFloat(raw);
    const ms = secs * 1000;
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
      setAutostartError(
        "Failed to change autostart setting. Please try again.",
      );
      setStartWithOS(!value);
      console.warn("autostart error:", err);
    }
  };

  const handlePingTarget = useCallback(
    (target: string) => {
      setLocalPingTarget(target);
      if (pingDebounceRef.current) clearTimeout(pingDebounceRef.current);
      const isValid = /^[a-zA-Z0-9.\-:]+$/.test(target) && target.length > 0;
      if (isValid) {
        pingDebounceRef.current = setTimeout(() => {
          setPingTarget(target);
          invoke("set_ping_target", { target }).catch(console.warn);
        }, 500);
      }
    },
    [setPingTarget],
  );

  useEffect(() => {
    return () => {
      if (pingDebounceRef.current) clearTimeout(pingDebounceRef.current);
    };
  }, []);

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
  };

  return (
    <div className="p-7 px-8 w-full max-w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[22px] font-semibold text-text tracking-[-0.02em] leading-none mb-[5px]">
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
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-[13px] border-b border-accent-soft-2">
            <div>
              <div className="text-[13px] text-text font-[450]">
                Dashboard refresh interval
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                How often the dashboard UI updates (backend always samples at
                500ms)
              </div>
            </div>
            <select
              className="text-[12px] font-sans text-accent-strong bg-accent-soft border border-accent-border rounded-[7px] px-2.5 py-[5px] cursor-pointer outline-none"
              value={String(pollIntervalMs / 1000)}
              onChange={(e) => handleInterval(e.target.value)}
            >
              <option value="0.5">0.5 seconds</option>
              <option value="1">1 second</option>
              <option value="2">2 seconds</option>
              <option value="5">5 seconds</option>
            </select>
          </div>

          <div className="flex items-center justify-between px-[18px] py-[13px] border-b border-accent-soft-2">
            <div>
              <div className="text-[13px] text-text font-[450]">
                Display units
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                {displayUnits === "bytes"
                  ? "Bytes per second — adaptive (B/s, KB/s, MB/s, GB/s)"
                  : "Bits per second — adaptive (bps, Kbps, Mbps, Gbps)"}
              </div>
            </div>
            <select
              className="text-[12px] font-sans text-accent-strong bg-accent-soft border border-accent-border rounded-[7px] px-2.5 py-[5px] cursor-pointer outline-none"
              value={displayUnits}
              onChange={(e) => handleUnits(e.target.value)}
            >
              <option value="bytes">Bytes/s (KB/s, MB/s, GB/s)</option>
              <option value="bits">Bits/s (Kbps, Mbps, Gbps)</option>
            </select>
          </div>

          <div className="flex items-center justify-between px-[18px] py-[13px] border-b border-accent-soft-2">
            <div>
              <div className="text-[13px] text-text font-[450]">
                Ping target
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                IP or hostname to ping for latency
              </div>
            </div>
            <input
              type="text"
              className="text-[12px] font-mono text-text bg-panel border border-border rounded-[7px] px-2.5 py-[5px] outline-none w-40 transition-colors focus:border-accent-border"
              value={localPingTarget}
              onChange={(e) => handlePingTarget(e.target.value)}
              placeholder="e.g. 1.1.1.1"
              pattern="[a-zA-Z0-9.\-:]+"
            />
          </div>

          <div className="flex items-center justify-between px-[18px] py-[13px]">
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
              className={`w-[38px] h-[21px] rounded-[11px] flex items-center p-0.5 cursor-pointer transition-colors shrink-0 ${startWithOS ? "bg-accent" : "bg-accent-muted"} ${!autostartAvailable ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
              onClick={() => handleStartWithOS(!startWithOS)}
              role="switch"
              aria-checked={startWithOS}
              aria-disabled={!autostartAvailable}
              tabIndex={autostartAvailable ? 0 : -1}
              onKeyDown={(e) => {
                if (
                  autostartAvailable &&
                  (e.key === " " || e.key === "Enter")
                ) {
                  e.preventDefault();
                  handleStartWithOS(!startWithOS);
                }
              }}
            >
              <div
                className={`w-[17px] h-[17px] rounded-full bg-white transition-transform shadow-[0_1px_3px_rgba(0,0,0,0.15)] ${startWithOS ? "translate-x-[17px]" : "translate-x-0"}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-accent uppercase tracking-[0.08em] mb-3">
          Appearance
        </div>
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-[13px] border-b border-accent-soft-2">
            <div>
              <div className="text-[13px] text-text font-[450]">Dark mode</div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Switch between light and dark
              </div>
            </div>
            <div
              className={`w-[38px] h-[21px] rounded-[11px] flex items-center p-0.5 cursor-pointer transition-colors shrink-0 ${colorMode === "dark" ? "bg-accent" : "bg-accent-muted"}`}
              onClick={() =>
                handleColorMode(colorMode === "dark" ? "light" : "dark")
              }
              role="switch"
              aria-checked={colorMode === "dark"}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  handleColorMode(colorMode === "dark" ? "light" : "dark");
                }
              }}
            >
              <div
                className={`w-[17px] h-[17px] rounded-full bg-white transition-transform shadow-[0_1px_3px_rgba(0,0,0,0.15)] ${colorMode === "dark" ? "translate-x-[17px]" : "translate-x-0"}`}
              />
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 px-[18px] py-[13px]">
            <div className="text-[13px] text-text font-[450]">
              Accent colour
            </div>
            <div
              className="flex gap-2 flex-wrap"
              role="radiogroup"
              aria-label="Accent colour"
            >
              {THEMES.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  className={`w-[26px] h-[26px] rounded-full cursor-pointer p-0 transition-transform hover:scale-[1.15] ${selectedTheme === i ? "border-2 border-accent" : isLightColor(t.color) ? "border-2 border-transparent" : "border-2 border-[rgba(255,255,255,0.3)]"}`}
                  style={{ background: t.color }}
                  title={t.label}
                  aria-label={`${t.label} theme`}
                  aria-pressed={selectedTheme === i}
                  onClick={() => handleTheme(i)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Data */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-accent uppercase tracking-[0.08em] mb-3">
          Data
        </div>
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-[13px]">
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
              className="bg-danger-bg text-danger-text border border-danger-border rounded-[7px] px-3 py-[5px] text-[12px] cursor-pointer font-sans transition-opacity hover:opacity-85"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 80;
}
