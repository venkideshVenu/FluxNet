import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PillWidget } from "./PillWidget";
import { useNetworkStore } from "../store/networkStore";

beforeEach(() => {
  useNetworkStore.setState({
    data: { uploadBytesPerSec: 0, downloadBytesPerSec: 0, interfaceName: "" },
    isConnected: false,
  });
});

describe("PillWidget", () => {
  it("renders upload and download sections", () => {
    render(<PillWidget />);
    // The aria-label covers both
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
  });

  it("shows 0.0 B/s when no data", () => {
    render(<PillWidget />);
    const vals = screen.getAllByText("0.0");
    expect(vals.length).toBeGreaterThanOrEqual(1);
  });

  it("displays formatted MB/s values from store", () => {
    useNetworkStore.setState({
      data: {
        uploadBytesPerSec: 12_582_912, // 12.0 MB/s
        downloadBytesPerSec: 91_488_870, // 87.3 MB/s
        interfaceName: "wlan0",
      },
      isConnected: true,
    });

    render(<PillWidget />);
    expect(screen.getByText("12.0")).toBeInTheDocument();
    expect(screen.getByText("87.3")).toBeInTheDocument();
  });

  it("shows connected live dot when isConnected is true", () => {
    useNetworkStore.setState({
      data: {
        uploadBytesPerSec: 1000,
        downloadBytesPerSec: 1000,
        interfaceName: "wlan0",
      },
      isConnected: true,
    });

    render(<PillWidget />);
    const dot = document.querySelector(".pill-live-dot.live");
    expect(dot).toBeInTheDocument();
  });

  it("shows dead dot when disconnected", () => {
    render(<PillWidget />);
    const dot = document.querySelector(".pill-live-dot.dead");
    expect(dot).toBeInTheDocument();
  });
});
