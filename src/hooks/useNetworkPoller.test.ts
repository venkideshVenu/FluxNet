import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNetworkPoller } from "./useNetworkPoller";
import { useNetworkStore } from "../store/networkStore";

// Mock the Tauri invoke function
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.useFakeTimers();
  useNetworkStore.setState({
    data: { uploadBytesPerSec: 0, downloadBytesPerSec: 0, interfaceName: "" },
    isConnected: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useNetworkPoller", () => {
  it("calls get_network_stats on mount", async () => {
    mockInvoke.mockResolvedValue({
      upload_bytes_per_sec: 1_000_000,
      download_bytes_per_sec: 5_000_000,
      interface_name: "wlan0",
    });

    renderHook(() => useNetworkPoller(1000));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_network_stats");
    });
  });

  it("writes data into the store", async () => {
    mockInvoke.mockResolvedValue({
      upload_bytes_per_sec: 2_000_000,
      download_bytes_per_sec: 8_000_000,
      interface_name: "eth0",
    });

    renderHook(() => useNetworkPoller(1000));

    await waitFor(() => {
      const { data } = useNetworkStore.getState();
      expect(data.uploadBytesPerSec).toBe(2_000_000);
      expect(data.interfaceName).toBe("eth0");
    });
  });

  it("marks disconnected on invoke error", async () => {
    mockInvoke.mockRejectedValue(new Error("IPC error"));

    renderHook(() => useNetworkPoller(1000));

    await waitFor(() => {
      expect(useNetworkStore.getState().isConnected).toBe(false);
    });
  });

  it("polls again after interval", async () => {
    mockInvoke.mockResolvedValue({
      upload_bytes_per_sec: 0,
      download_bytes_per_sec: 0,
      interface_name: "wlan0",
    });

    renderHook(() => useNetworkPoller(1000));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledTimes(1));

    vi.advanceTimersByTime(1000);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledTimes(2));
  });
});