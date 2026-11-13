/**
 * Follows the Windows look: the user's accent colour and, on Windows 11, the
 * Mica backdrop of the dashboard window. Both come from the backend's
 * `get_appearance` command; without it (Windows 10, other platforms, tests)
 * the default Windows blue from tokens.css and an opaque background are used.
 */

export type AccentPalette = {
  light3: string;
  light2: string;
  light1: string;
  base: string;
  dark1: string;
  dark2: string;
  dark3: string;
};

export type Appearance = {
  accent: AccentPalette | null;
  material: "mica" | "solid";
};

const STYLE_ID = "fluxnet-accent";

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : hex;
}

export function isAccentPalette(value: unknown): value is AccentPalette {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return [
    "light3",
    "light2",
    "light1",
    "base",
    "dark1",
    "dark2",
    "dark3",
  ].every((k) => typeof p[k] === "string" && hexToRgb(p[k] as string) !== null);
}

/**
 * CSS that maps the palette onto the accent tokens the way WinUI does:
 * Dark1/Dark2 on light backgrounds, Light2/Light3 on dark ones.
 */
export function accentCss(p: AccentPalette): string {
  return `:root{--accent:${p.dark1};--accent-hover:${rgba(p.dark1, 0.9)};--accent-pressed:${rgba(p.dark1, 0.8)};--accent-text:${p.dark2};--accent-subtle:${rgba(p.dark1, 0.1)};--on-accent:#ffffff}
:root[data-theme="dark"]{--accent:${p.light2};--accent-hover:${rgba(p.light2, 0.9)};--accent-pressed:${rgba(p.light2, 0.8)};--accent-text:${p.light3};--accent-subtle:${rgba(p.light2, 0.12)};--on-accent:#000000}`;
}

export function applyAppearance(appearance: Partial<Appearance> | null) {
  const root = document.documentElement;
  root.setAttribute(
    "data-material",
    appearance?.material === "mica" ? "mica" : "solid",
  );

  const existing = document.getElementById(STYLE_ID);
  if (!appearance?.accent || !isAccentPalette(appearance.accent)) {
    existing?.remove();
    return;
  }
  const style = existing ?? document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = accentCss(appearance.accent);
  if (!existing) document.head.appendChild(style);
}
