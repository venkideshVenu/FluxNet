import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  CalendarDays,
  Clock,
  Gauge,
  Info,
  MonitorDown,
  Palette,
  Power,
  RotateCcw,
  Ruler,
} from "lucide-react";
import { invoke } from "@/api";
import { applyThemeMode } from "@/hooks";
import { useNetworkStore, useSettingsStore } from "@/store";
import type { DateFormat, DisplayUnits, StartOfWeek, TimeFormat } from "@/store";
import { getStoredColorMode, setStorageItem, type ColorMode } from "@/utils";
import { useToast } from "@/components";
import {
  Button,
  ComboBox,
  Page,
  PageHeader,
  SettingsCard,
  SettingsGroup,
  ToggleSwitch,
} from "@/components/fluent";

const REFRESH_OPTIONS = [
  { value: "0.5", label: "Every 0.5 seconds" },
  { value: "1", label: "Every second" },
  { value: "2", label: "Every 2 seconds" },
  { value: "5", label: "Every 5 seconds" },
];

const UNIT_OPTIONS: { value: DisplayUnits; label: string }[] = [
  { value: "bytes", label: "Bytes (KB/s, MB/s)" },
  { value: "bits", label: "Bits (Kbps, Mbps)" },
];

const THEME_OPTIONS: { value: ColorMode; label: string }[] = [
  { value: "system", label: "Use system setting" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const TIME_OPTIONS: { value: TimeFormat; label: string }[] = [
  { value: "12h", label: "12-hour (1:30 PM)" },
  { value: "24h", label: "24-hour (13:30)" },
];

const DATE_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

const WEEK_OPTIONS: { value: StartOfWeek; label: string }[] = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
  { value: "saturday", label: "Saturday" },
];

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

  const [colorMode, setColorMode] = useState<ColorMode>(getStoredColorMode);
  const [startWithWindows, setStartWithWindows] = useState(false);
  const [autostartAvailable, setAutostartAvailable] = useState(true);
  const [keepRunning, setKeepRunning] = useState(true);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    invoke<number>("get_refresh_interval")
      .then((ms) => {
        if (Number.isFinite(ms) && ms > 0) setPollInterval(ms);
      })
      .catch(console.warn);
    invoke<boolean>("get_minimize_to_tray")
      .then((v) => setKeepRunning(Boolean(v)))
      .catch(console.warn);
    invoke<boolean>("plugin:autostart|is_enabled")
      .then((enabled) => {
        setStartWithWindows(Boolean(enabled));
        setAutostartAvailable(true);
      })
      .catch(() => setAutostartAvailable(false));
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, [setPollInterval]);

  const handleRefresh = (raw: string) => {
    const ms = Math.round(Number.parseFloat(raw) * 1000);
    setPollInterval(ms);
    invoke("set_refresh_interval", { intervalMs: ms }).catch(console.warn);
  };

  const handleTheme = (mode: ColorMode) => {
    setColorMode(mode);
    setStorageItem("fluxnet_color_mode", mode);
    applyThemeMode(mode);
  };

  const handleStartWithWindows = async (value: boolean) => {
    setStartWithWindows(value);
    try {
      await invoke(value ? "plugin:autostart|enable" : "plugin:autostart|disable");
    } catch {
      setStartWithWindows(!value);
      showToast("Couldn't change the startup setting", "error");
    }
  };

  const handleKeepRunning = async (value: boolean) => {
    setKeepRunning(value);
    try {
      await invoke("set_minimize_to_tray", { enabled: value });
    } catch {
      setKeepRunning(!value);
      showToast("Couldn't save this setting", "error");
    }
  };

  const handleResetPeaks = () => {
    resetPeaks();
    invoke("reset_peaks").catch(console.warn);
    showToast("Peak speeds reset", "success");
  };

  return (
    <Page>
      <PageHeader title="Settings" />

      <SettingsGroup title="Monitoring">
        <SettingsCard
          icon={<Gauge />}
          header="Refresh rate"
          description="How often Overview updates. Measurements are always taken twice a second."
        >
          <ComboBox
            label="Refresh rate"
            value={String(pollIntervalMs / 1000)}
            options={REFRESH_OPTIONS}
            onChange={handleRefresh}
          />
        </SettingsCard>
        <SettingsCard icon={<Ruler />} header="Speed units">
          <ComboBox
            label="Speed units"
            value={displayUnits}
            options={UNIT_OPTIONS}
            onChange={setDisplayUnits}
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Appearance">
        <SettingsCard
          icon={<Palette />}
          header="App theme"
          description="Colors follow your Windows accent color"
        >
          <ComboBox
            label="App theme"
            value={colorMode}
            options={THEME_OPTIONS}
            onChange={handleTheme}
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Time and date">
        <SettingsCard icon={<Clock />} header="Time format">
          <ComboBox
            label="Time format"
            value={timeFormat}
            options={TIME_OPTIONS}
            onChange={setTimeFormat}
          />
        </SettingsCard>
        <SettingsCard icon={<CalendarDays />} header="Date format">
          <ComboBox
            label="Date format"
            value={dateFormat}
            options={DATE_OPTIONS}
            onChange={setDateFormat}
          />
        </SettingsCard>
        <SettingsCard icon={<CalendarDays />} header="First day of the week">
          <ComboBox
            label="First day of the week"
            value={startOfWeek}
            options={WEEK_OPTIONS}
            onChange={setStartOfWeek}
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Startup">
        <SettingsCard
          icon={<Power />}
          header="Start with Windows"
          description={
            autostartAvailable ? undefined : "Not available on this system"
          }
        >
          <ToggleSwitch
            label="Start with Windows"
            checked={startWithWindows}
            disabled={!autostartAvailable}
            onChange={handleStartWithWindows}
          />
        </SettingsCard>
        <SettingsCard
          icon={<MonitorDown />}
          header="Keep running in the notification area"
          description="Closing the window leaves FluxNet and its widgets running"
        >
          <ToggleSwitch
            label="Keep running in the notification area"
            checked={keepRunning}
            onChange={handleKeepRunning}
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Data">
        <SettingsCard
          icon={<RotateCcw />}
          header="Reset peak speeds"
          description="Clears the highest download and upload speeds since FluxNet started"
        >
          <Button onClick={handleResetPeaks}>Reset</Button>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingsCard
          icon={<Info />}
          header="FluxNet"
          description="Licensed under the GNU General Public License v3"
        >
          <span className="text-body text-fg-secondary select-text">
            {version ? `Version ${version}` : ""}
          </span>
        </SettingsCard>
      </SettingsGroup>
    </Page>
  );
}
