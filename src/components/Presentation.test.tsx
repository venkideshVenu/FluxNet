import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PillPresentation } from "./PillPresentation";
import { HudPresentation } from "./HudPresentation";

/**
 * jsdom does no layout, so these tests pin the CSS contract that keeps the
 * largest possible values inside the fixed-size widget windows. Visual
 * checks still need a real WebView.
 */

describe("PillPresentation", () => {
  const largest = {
    downloadValue: "1023.9",
    downloadUnit: "KB/s",
    uploadValue: "1023.9",
    uploadUnit: "KB/s",
    isConnected: true,
  };

  it("renders the largest values in full", () => {
    render(<PillPresentation {...largest} />);
    expect(screen.getAllByText("1023.9")).toHaveLength(2);
  });

  it("sizes value columns in ch so six characters fit", () => {
    render(<PillPresentation {...largest} />);
    for (const el of screen.getAllByText("1023.9")) {
      expect(el.className).toContain("w-[6ch]");
      expect(el.className).toContain("text-ellipsis");
    }
  });

  it.each([
    [{ isConnected: true, hasInterface: true }, "live"],
    [{ isConnected: false, hasInterface: true }, "dead"],
    [{ isConnected: true, hasInterface: false }, "no-interface"],
  ])("exposes dot state %o as %s", (props, state) => {
    const { container } = render(<PillPresentation {...largest} {...props} />);
    expect(
      container.querySelector("[data-state]")?.getAttribute("data-state"),
    ).toBe(state);
  });

  it("uses a valid dark-mode variant for the connected dot", () => {
    const { container } = render(<PillPresentation {...largest} />);
    const dot = container.querySelector('[data-state="live"]')!;
    expect(dot.className).toContain("in-data-[theme='dark']:bg-[#22d97d]");
    expect(dot.className).not.toContain("_&]");
  });
});

describe("HudPresentation", () => {
  const largest = {
    downloadValue: "1023.9",
    downloadUnit: "KB/s",
    uploadValue: "1023.9",
    uploadUnit: "KB/s",
    latencyMs: 999,
    lossPercent: 100,
  };

  it("horizontal: shows every field at its largest", () => {
    render(<HudPresentation {...largest} design="horizontal" />);
    expect(screen.getByText("999ms")).toBeInTheDocument();
    expect(screen.getByText("100.0%")).toBeInTheDocument();
    expect(screen.getAllByText("1023.9KB")).toHaveLength(2);
  });

  it("horizontal: traffic values truncate instead of overflowing", () => {
    render(<HudPresentation {...largest} design="horizontal" />);
    for (const el of screen.getAllByText("1023.9KB")) {
      expect(el.className).toContain("truncate");
      expect(el.parentElement?.className).toContain("min-w-0");
    }
  });

  it("vertical: shows units separately", () => {
    render(<HudPresentation {...largest} design="vertical" />);
    expect(screen.getAllByText("KB/s")).toHaveLength(2);
    expect(screen.getByText("999ms")).toBeInTheDocument();
  });

  it("shows a dash when latency is unknown", () => {
    render(<HudPresentation {...largest} latencyMs={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
