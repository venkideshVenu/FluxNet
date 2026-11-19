/**
 * Development-only stand-in for the Rust backend, so the UI can be run and
 * reviewed in a normal browser (`pnpm dev:web`) on any OS.
 *
 * It is only imported when `import.meta.env.DEV` is true and the page is not
 * running inside Tauri, so it never ships in a release build.
 *
 * Query parameters:
 *   ?window=pill|compact|hud|main   which window to render (default: main)
 *   &theme=light|dark               force a colour mode
 *   &material=mica|solid            simulate the Windows 11 backdrop
 *   &onboarding=1                   start in the first-run flow
 *   &route=/history                 open a dashboard page directly
 *   &state=empty|offline            show empty or disconnected states
 */
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

type Args = Record<string, unknown> | undefined;

const params = new URLSearchParams(window.location.search);
let automaticInterface = true;
const scenario = params.get("state") ?? "normal";

// Small deterministic PRNG so screenshots are stable between runs.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const now = Math.floor(Date.now() / 1000);
const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

function makeHistory() {
  const rand = rng(7);
  const points: { upload: number; download: number; t: number }[] = [];
  let burst = 0;
  for (let i = 599; i >= 0; i--) {
    if (rand() < 0.02) burst = 6 + Math.floor(rand() * 20);
    const base = 18 * KB + rand() * 40 * KB;
    const download = burst > 0 ? 1.5 * MB + rand() * 3.5 * MB : base;
    const upload =
      burst > 0 ? 120 * KB + rand() * 380 * KB : 4 * KB + rand() * 12 * KB;
    if (burst > 0) burst--;
    points.push({ upload, download, t: now - i });
  }
  return points;
}

const history = scenario === "empty" ? [] : makeHistory();
const latest = history.at(-1) ?? { upload: 0, download: 0 };

const interfaces = [
  {
    name: "Wi-Fi",
    description: "Intel(R) Wi-Fi 6E AX211 160MHz",
    if_index: 12,
    status: scenario === "offline" ? "Disconnected" : "Up",
    mac: "8C-17-59-3A-B2-F0",
    link_speed_bps: 1_201_000_000,
    interface_type: "wifi",
  },
  {
    name: "Ethernet",
    description: "Realtek PCIe 2.5GbE Family Controller",
    if_index: 7,
    status: "Disconnected",
    mac: "04-7C-16-E2-91-0A",
    link_speed_bps: 0,
    interface_type: "ethernet",
  },
  {
    name: "vEthernet (WSL)",
    description: "Hyper-V Virtual Ethernet Adapter",
    if_index: 31,
    status: "Up",
    mac: "00-15-5D-81-4C-22",
    link_speed_bps: 10_000_000_000,
    interface_type: "virtual",
  },
  {
    name: "Bluetooth Network Connection",
    description: "Bluetooth Device (Personal Area Network)",
    if_index: 9,
    status: "Disconnected",
    mac: "8C-17-59-3A-B2-F4",
    link_speed_bps: 3_000_000,
    interface_type: "bluetooth",
  },
];

let currentInterface = scenario === "empty" ? "" : "Wi-Fi";

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function makeHourly() {
  const rand = rng(11);
  const rows = [];
  const hourStart = now - (now % 3600);
  for (let i = 47; i >= 1; i--) {
    const start = hourStart - i * 3600;
    const hour = new Date(start * 1000).getHours();
    if (hour >= 1 && hour <= 6) continue; // asleep
    if (rand() < 0.15) continue; // laptop closed
    const busy = hour >= 9 && hour <= 23 ? 1 : 0.2;
    const dl = (40 + rand() * 900) * MB * busy;
    const ul = dl * (0.05 + rand() * 0.25);
    rows.push({
      hourStart: start,
      avgDownloadBps: dl / 3600,
      avgUploadBps: ul / 3600,
      peakDownloadBps: (dl / 3600) * (3 + rand() * 6),
      peakUploadBps: (ul / 3600) * (3 + rand() * 6),
      totalDownloadBytes: Math.round(dl),
      totalUploadBytes: Math.round(ul),
      sampleCount: 7200,
    });
  }
  return rows;
}

function makeDaily() {
  const rand = rng(23);
  const rows = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dl = (1.2 + rand() * 9) * GB * (i === 0 ? 0.35 : 1);
    const ul = dl * (0.08 + rand() * 0.2);
    rows.push({
      day: dayKey(d),
      avgDownloadBps: dl / 86400,
      avgUploadBps: ul / 86400,
      peakDownloadBps: 6 * MB + rand() * 40 * MB,
      peakUploadBps: 1 * MB + rand() * 8 * MB,
      totalDownloadBytes: Math.round(dl),
      totalUploadBytes: Math.round(ul),
    });
  }
  return rows;
}

function makeMonthly() {
  const rand = rng(31);
  const rows = [];
  for (let i = 9; i >= 1; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const dl = (60 + rand() * 180) * GB;
    rows.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      totalDownloadBytes: Math.round(dl),
      totalUploadBytes: Math.round(dl * (0.1 + rand() * 0.15)),
      peakDownloadBps: 20 * MB + rand() * 60 * MB,
      peakUploadBps: 4 * MB + rand() * 10 * MB,
    });
  }
  return rows;
}

const hourly = scenario === "empty" ? [] : makeHourly();
const daily = scenario === "empty" ? [] : makeDaily();
const monthly = scenario === "empty" ? [] : makeMonthly();

function usageStats() {
  const today = daily.find((d) => d.day === dayKey(new Date()));
  const last7 = daily.slice(-7);
  const month = daily.filter((d) =>
    d.day.startsWith(dayKey(new Date()).slice(0, 7)),
  );
  const sum = (
    rows: typeof daily,
    k: "totalDownloadBytes" | "totalUploadBytes",
  ) => rows.reduce((acc, r) => acc + r[k], 0);
  return {
    todayDownloadBytes: today?.totalDownloadBytes ?? 0,
    todayUploadBytes: today?.totalUploadBytes ?? 0,
    weekDownloadBytes: sum(last7, "totalDownloadBytes"),
    weekUploadBytes: sum(last7, "totalUploadBytes"),
    monthDownloadBytes: sum(month, "totalDownloadBytes"),
    monthUploadBytes: sum(month, "totalUploadBytes"),
    peakDownloadBps: scenario === "empty" ? 0 : 41.7 * MB,
    peakUploadBps: scenario === "empty" ? 0 : 9.2 * MB,
  };
}

const widgetVisibility: Record<string, boolean> = {
  pill: true,
  compact: false,
  hud: false,
};
let hudDesign = params.get("hud") === "vertical" ? "vertical" : "horizontal";
let refreshInterval = 1000;
let minimizeToTray = true;
let autostart = true;
let onboardingCompleted = params.get("onboarding") !== "1";

function handle(cmd: string, args: Args): unknown {
  switch (cmd) {
    case "get_network_stats":
      return {
        upload_bytes_per_sec: latest.upload,
        download_bytes_per_sec: latest.download,
        interface_name: currentInterface,
      };
    case "get_dashboard_snapshot":
      return {
        current_upload: latest.upload,
        current_download: latest.download,
        peak_upload: history.reduce((m, p) => Math.max(m, p.upload), 0),
        peak_download: history.reduce((m, p) => Math.max(m, p.download), 0),
        interface_name: currentInterface,
        is_connected: scenario !== "offline" && history.length > 0,
        history,
      };
    case "get_ping_stats":
      return { latency_ms: 18, loss_percent: 0 };
    case "get_interfaces":
      return interfaces;
    case "set_interface":
      currentInterface = String(args?.name ?? "");
      automaticInterface = false;
      return null;
    case "get_interface_automatic":
      return automaticInterface;
    case "set_interface_automatic":
      automaticInterface = true;
      return null;
    case "get_usage_stats_cmd":
      return usageStats();
    case "get_hourly_summary":
      return hourly;
    case "get_daily_summary":
      return daily;
    case "get_monthly_summary":
      return monthly;
    case "get_onboarding_completed":
      return onboardingCompleted;
    case "set_onboarding_completed":
      onboardingCompleted = true;
      return null;
    case "get_refresh_interval":
      return refreshInterval;
    case "set_refresh_interval":
      refreshInterval = Number(args?.intervalMs ?? 1000);
      return null;
    case "get_minimize_to_tray":
      return minimizeToTray;
    case "set_minimize_to_tray":
      minimizeToTray = Boolean(args?.enabled);
      return null;
    case "get_widget_visibility":
      return widgetVisibility[String(args?.label)] ?? false;
    case "set_widget_visibility":
      widgetVisibility[String(args?.label)] = Boolean(args?.visible);
      return null;
    case "fit_widget_window":
      showWindowBounds(Number(args?.width), Number(args?.height));
      return null;
    case "get_hud_design":
      return hudDesign;
    case "set_hud_design":
      hudDesign = String(args?.design ?? "horizontal");
      return null;
    case "get_appearance":
      return {
        accent: null,
        material: params.get("material") === "mica" ? "mica" : "solid",
      };
    case "plugin:autostart|is_enabled":
      return autostart;
    case "plugin:autostart|enable":
      autostart = true;
      return null;
    case "plugin:autostart|disable":
      autostart = false;
      return null;
    case "plugin:app|version":
      return "0.1.2";
    case "plugin:event|listen":
      return Math.floor(Math.random() * 1e9);
    default:
      // Window commands (set_theme, start_dragging, …) and setters.
      return null;
  }
}

/** Outlines the size a widget asked its window to be, to check the fit. */
function showWindowBounds(width: number, height: number) {
  let box = document.getElementById("mock-window-bounds");
  if (!box) {
    box = document.createElement("div");
    box.id = "mock-window-bounds";
    box.style.cssText =
      "position:fixed;left:0;top:0;outline:1px dashed #ff4d4f;pointer-events:none;z-index:9999";
    document.body.appendChild(box);
  }
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
  box.title = `${width}×${height}`;
}

export function installMockBackend() {
  mockWindows(params.get("window") ?? "main");
  mockIPC((cmd, args) => handle(cmd, args as Args));

  const theme = params.get("theme");
  if (theme === "light" || theme === "dark") {
    localStorage.setItem("fluxnet_color_mode", theme);
    for (const key of [
      "fluxnet_pill_mode",
      "fluxnet_compact_mode",
      "fluxnet_hud_mode",
    ]) {
      localStorage.setItem(key, theme);
    }
  }
  if (params.get("material") === "mica") {
    // Approximate the Mica tint so the translucent layers read correctly.
    document.documentElement.style.background =
      theme === "light"
        ? "linear-gradient(135deg, #e9eef6, #f4eef2)"
        : "linear-gradient(135deg, #1c2128, #241f26)";
  }
  if (params.get("window") && params.get("window") !== "main") {
    // A desktop-like backdrop behind transparent widget windows.
    document.documentElement.style.background =
      theme === "light" ? "#dfe6ee" : "#1b2a3a";
  }
  if (!onboardingCompleted) localStorage.removeItem("fluxnet_configured");
  else localStorage.setItem("fluxnet_configured", "true");
  const route = params.get("route");
  if (route)
    window.history.replaceState(null, "", route + window.location.search);
}
