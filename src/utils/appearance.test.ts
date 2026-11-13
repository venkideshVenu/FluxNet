import { afterEach, describe, it, expect } from "vitest";
import { accentCss, applyAppearance, isAccentPalette, type AccentPalette } from "./appearance";

const BLUE: AccentPalette = {
  light3: "#99ebff",
  light2: "#4cc2ff",
  light1: "#0091f8",
  base: "#0078d4",
  dark1: "#0067c0",
  dark2: "#003e92",
  dark3: "#001a68",
};

afterEach(() => {
  document.getElementById("fluxnet-accent")?.remove();
  document.documentElement.removeAttribute("data-material");
});

describe("accent palette", () => {
  it("validates palettes", () => {
    expect(isAccentPalette(BLUE)).toBe(true);
    expect(isAccentPalette({ ...BLUE, dark1: "blue" })).toBe(false);
    expect(isAccentPalette(null)).toBe(false);
  });

  it("uses Dark1 on light backgrounds and Light2 on dark ones, as WinUI does", () => {
    const css = accentCss(BLUE);
    expect(css).toMatch(/:root\{--accent:#0067c0;/);
    expect(css).toMatch(/\[data-theme="dark"\]\{--accent:#4cc2ff;/);
    expect(css).toContain("--accent-text:#003e92");
    expect(css).toContain("--accent-text:#99ebff");
    expect(css).toContain("--on-accent:#ffffff");
    expect(css).toContain("--on-accent:#000000");
  });
});

describe("applyAppearance", () => {
  it("injects one accent stylesheet and sets the backdrop material", () => {
    applyAppearance({ accent: BLUE, material: "mica" });
    applyAppearance({ accent: BLUE, material: "mica" });
    expect(document.querySelectorAll("#fluxnet-accent")).toHaveLength(1);
    expect(document.documentElement.getAttribute("data-material")).toBe("mica");
  });

  it("falls back to the default accent and an opaque background", () => {
    applyAppearance({ accent: BLUE, material: "mica" });
    applyAppearance(null);
    expect(document.getElementById("fluxnet-accent")).toBeNull();
    expect(document.documentElement.getAttribute("data-material")).toBe("solid");
  });
});
