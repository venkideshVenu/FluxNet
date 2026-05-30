export type ColorMode = "light" | "dark";

type Rgb = { r: number; g: number; b: number };

type ThemeSwatch = { color: string; label: string };

export const THEMES: ThemeSwatch[] = [
  { color: "#7C6FF7", label: "Violet" },
  { color: "#22C97A", label: "Mint" },
  { color: "#4FBBF7", label: "Sky" },
  { color: "#F59E0B", label: "Amber" },
  { color: "#EF4444", label: "Coral" },
  { color: "#1A1830", label: "Midnight" },
];

export const LS_THEME = "fluxnet_accent_index";
export const LS_MODE = "fluxnet_color_mode";
export const LS_PILL_MODE = "fluxnet_pill_mode";
export const LS_COMPACT_MODE = "fluxnet_compact_mode";

function hexToRgb(hex: string): Rgb | null {
  const normalized = hex.trim().replace("#", "");
  if (normalized.length !== 6) return null;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)
    ? null
    : { r, g, b };
}

function mixRgb(a: Rgb, b: Rgb, ratio: number): Rgb {
  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  return {
    r: clamp(Math.round(a.r + (b.r - a.r) * ratio)),
    g: clamp(Math.round(a.g + (b.g - a.g) * ratio)),
    b: clamp(Math.round(a.b + (b.b - a.b) * ratio)),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Apply the accent colour as CSS variables on <html> */
export function applyAccent(color: string) {
  const root = document.documentElement.style;
  root.setProperty("--accent", color);

  const rgb = hexToRgb(color);
  if (!rgb) return;

  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  root.setProperty("--accent-strong", rgbToHex(mixRgb(rgb, black, 0.25)));
  root.setProperty("--accent-soft", rgbToHex(mixRgb(rgb, white, 0.9)));
  root.setProperty("--accent-soft-2", rgbToHex(mixRgb(rgb, white, 0.94)));
  root.setProperty("--accent-border", rgbToHex(mixRgb(rgb, white, 0.7)));
  root.setProperty("--accent-muted", rgbToHex(mixRgb(rgb, white, 0.8)));
  root.setProperty(
    "--accent-shadow",
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
  );
}

/** Apply the light/dark mode as a data attribute on <html> */
export function applyColorMode(mode: ColorMode) {
  document.documentElement.setAttribute("data-theme", mode);
}

export function getStoredAccentIndex(fallback = 0): number {
  const saved = localStorage.getItem(LS_THEME);
  const parsed = saved ? Number(saved) : fallback;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getStoredColorMode(): ColorMode {
  const saved = localStorage.getItem(LS_MODE);
  if (saved === "light" || saved === "dark") return saved;
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function getStoredPillMode(): ColorMode {
  const saved = localStorage.getItem(LS_PILL_MODE);
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}

export function getStoredCompactMode(): ColorMode {
  const saved = localStorage.getItem(LS_COMPACT_MODE);
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}
