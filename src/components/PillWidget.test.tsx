import { describe, it, expect, vi, beforeEach } from "vitest";import { render, screen } from "@testing-library/react";
import { PillWidget } from "./PillWidget";
import { useNetworkStore } from "@/store";

// Mock Tauri APIs via the abstraction layer
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    label: "pill",
    startDragging: vi.fn(),
    outerPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    setPosition: vi.fn(),
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("PillWidget", () => {
  beforeEach(() => {
    useNetworkStore.setState({
      data: {
        uploadBytesPerSec: 1_048_576, // 1 MB/s
        downloadBytesPerSec: 5_242_880, // 5 MB/s
        interfaceName: "Wi-Fi",
      },
      isConnected: true,
      isInitialized: true,
    });
  });

  it("renders download and upload values", () => {
    render(<PillWidget />);
    expect(screen.getByText("5.0")).toBeInTheDocument();
    expect(screen.getByText("1.0")).toBeInTheDocument();
  });

  it("renders units", () => {
    render(<PillWidget />);
    const mbUnits = screen.getAllByText("MB/s");
    expect(mbUnits.length).toBeGreaterThanOrEqual(2);
  });

  it("shows live dot when connected", () => {
    render(<PillWidget />);
    const dot = document.querySelector(".pill-live-dot.live");
    expect(dot).toBeTruthy();
  });

  it("shows dead dot when disconnected", () => {
    useNetworkStore.setState({ isConnected: false });
    render(<PillWidget />);
    const dot = document.querySelector(".pill-live-dot.dead");
    expect(dot).toBeTruthy();
  });

  it("has accessible role and label", () => {
    render(<PillWidget />);
    const container = screen.getByRole("status");
    expect(container).toBeTruthy();
    expect(container.getAttribute("aria-label")).toContain("Download");
    expect(container.getAttribute("aria-label")).toContain("Upload");
  });

  it("has tabIndex for keyboard accessibility", () => {
    render(<PillWidget />);
    const container = screen.getByRole("status");
    expect(container.getAttribute("tabindex")).toBe("0");
  });

  /**
   * NOTE (Issue 16.3): Drag behavior (onMouseDown → startDragging) cannot be
   * meaningfully tested in jsdom because:
   * 1. Tauri's startDragging() is a native window operation
   * 2. jsdom has no concept of window drag
   * 3. The mock would only verify the function was called, not actual behavior
   *
   * Drag testing should be done via Tauri's E2E test framework if needed.
   *
   * Similarly, keyboard nudge (arrow keys → setPosition) uses native window
   * positioning which is not available in jsdom.
   */
});