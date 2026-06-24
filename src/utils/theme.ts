import { getStorageItem } from "./storage";

export type ColorMode = "light" | "dark" | "system";

type Rgb = { r: number; g: number; b: number };

type ThemeSwatch = {
  color: string;
  label: string;
  modes: ("light" | "dark")[];
};

export const THEMES: ThemeSwatch[] = [
  { color: "#7C6FF7", label: "Violet", modes: ["light", "dark"] },
  { color: "#22C97A", label: "Mint", modes: ["light", "dark"] },
  { color: "#4FBBF7", label: "Sky", modes: ["light", "dark"] },
  { color: "#F59E0B", label: "Amber", modes: ["light", "dark"] },
  { color: "#EF4444", label: "Coral", modes: ["light", "dark"] },
  { color: "#FFFFFF", label: "White", modes: ["dark"] },
  { color: "#1A1830", label: "Midnight", modes: ["light"] },
];

/**
 * Returns accent colors appropriate for the given effective theme.
 */
export function getFilteredThemes(
  effectiveTheme: "light" | "dark",
): ThemeSwatch[] {
  return THEMES.filter((t) => t.modes.includes(effectiveTheme));
}

export const LS_THEME = "fluxnet_accent_index" as const;
export const LS_MODE = "fluxnet_color_mode" as const;
export const LS_PILL_MODE = "fluxnet_pill_mode" as const;
export const LS_COMPACT_MODE = "fluxnet_compact_mode" as const;
export const LS_HUD_MODE = "fluxnet_hud_mode" as const;

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

/** Detect if a color is perceptually "white" or very light */
function isWhiteAccent(color: string): boolean {
  const rgb = hexToRgb(color);
  if (!rgb) return false;
  // Luminance check - if all channels are > 240, treat as white
  return rgb.r > 240 && rgb.g > 240 && rgb.b > 240;
}

export function applyAccent(color: string) {
  const root = document.documentElement;
  root.style.setProperty("--accent", color);

  // Set attribute for white accent detection (used by toggle knob, sidebar text)
  if (isWhiteAccent(color)) {
    root.setAttribute("data-accent-is-white", "true");
  } else {
    root.removeAttribute("data-accent-is-white");
  }

  const rgb = hexToRgb(color);
  if (!rgb) return;

  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  // For white accent, generate darker derivatives for readability
  if (isWhiteAccent(color)) {
    root.style.setProperty("--accent-strong", "#333333");
    root.style.setProperty("--accent-soft", "rgba(255,255,255,0.1)");
    root.style.setProperty("--accent-soft-2", "rgba(255,255,255,0.06)");
    root.style.setProperty("--accent-border", "rgba(255,255,255,0.3)");
    root.style.setProperty("--accent-muted", "rgba(255,255,255,0.2)");
    root.style.setProperty("--accent-shadow", "rgba(255,255,255,0.1)");
  } else {
    root.style.setProperty(
      "--accent-strong",
      rgbToHex(mixRgb(rgb, black, 0.25)),
    );
    root.style.setProperty("--accent-soft", rgbToHex(mixRgb(rgb, white, 0.9)));
    root.style.setProperty(
      "--accent-soft-2",
      rgbToHex(mixRgb(rgb, white, 0.94)),
    );
    root.style.setProperty(
      "--accent-border",
      rgbToHex(mixRgb(rgb, white, 0.7)),
    );
    root.style.setProperty("--accent-muted", rgbToHex(mixRgb(rgb, white, 0.8)));
    root.style.setProperty(
      "--accent-shadow",
      `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
    );
  }
}

export function getSystemTheme(): "light" | "dark" {
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function resolveColorMode(mode: ColorMode): "light" | "dark" {
  if (mode === "system") return getSystemTheme();
  return mode;
}

export function applyColorMode(mode: ColorMode) {
  document.documentElement.setAttribute("data-theme", resolveColorMode(mode));
}

export function getStoredAccentIndex(fallback = 0): number {
  return getStorageItem(LS_THEME, fallback);
}

export function getStoredColorMode(): ColorMode {
  const saved = getStorageItem(LS_MODE, "system");
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "system";
}

export function getStoredPillMode(): ColorMode {
  const saved = getStorageItem(LS_PILL_MODE, "dark");
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "dark";
}

export function getStoredCompactMode(): ColorMode {
  const saved = getStorageItem(LS_COMPACT_MODE, "dark");
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "dark";
}

export function getStoredHudMode(): ColorMode {
  const saved = getStorageItem(LS_HUD_MODE, "dark");
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "dark";
}
