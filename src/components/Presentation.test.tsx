import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PillPresentation } from "./PillPresentation";
import { HudPresentation } from "./HudPresentation";

/**
 * jsdom does no layout, so these tests pin the CSS contract: widgets size
 * themselves to their content (the window is fitted to them), and values
 * reserve room for their usual widest text so the widget doesn't change size
 * as they change. Visual checks still need a real WebView.
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

  it("sizes itself and reserves room for values, never cutting them", () => {
    const { container } = render(<PillPresentation {...largest} />);
    expect((container.firstChild as HTMLElement).className).toContain("w-max");
    for (const el of screen.getAllByText("1023.9")) {
      expect(el.className).not.toContain("ellipsis");
      expect(el.parentElement?.className).toContain("min-w-[calc(5ch+12px)]");
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

  it("colours the dot from the widget palette", () => {
    const { container } = render(<PillPresentation {...largest} />);
    const dot = container.querySelector('[data-state="live"]')!;
    expect(dot.className).toContain("bg-(--w-good)");
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

  it("horizontal: traffic values keep their room and are never cut", () => {
    render(<HudPresentation {...largest} design="horizontal" />);
    for (const el of screen.getAllByText("1023.9KB")) {
      expect(el.className).not.toContain("truncate");
      expect(el.className).toContain("min-w-[7ch]");
    }
  });

  it("vertical: lines values and units up in columns", () => {
    const { container } = render(
      <HudPresentation {...largest} design="vertical" />,
    );
    expect(
      container.querySelector(".grid-cols-\\[auto_auto_auto\\]"),
    ).not.toBeNull();
    expect(screen.getAllByText("KB/s")).toHaveLength(2);
    expect(screen.getByText("999")).toBeInTheDocument();
    expect(screen.getByText("ms")).toBeInTheDocument();
    expect(screen.getByText("100.0")).toBeInTheDocument();
  });

  it.each(["horizontal", "vertical"] as const)(
    "%s: has a solid background, so 100%% opacity is fully opaque",
    (design) => {
      const { container } = render(
        <HudPresentation {...largest} design={design} />,
      );
      expect(container.querySelector(".bg-\\(--w-bg\\)")).not.toBeNull();
    },
  );

  it("shows a dash when latency is unknown", () => {
    render(<HudPresentation {...largest} latencyMs={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
