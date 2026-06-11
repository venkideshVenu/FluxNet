import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNetworkPoller } from "./useNetworkPoller";
import { useNetworkStore } from "@/store";
import { useSettingsStore } from "@/store";

// ── Mocks ──────────────────────────────────────────────────────────────────

let mockWindowLabel = "pill";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ label: mockWindowLabel }),
}));

// Mock the network API layer
const mockPollNetworkData = vi.fn();
vi.mock("@/api", () => ({
  pollNetworkData: (...args: unknown[]) => mockPollNetworkData(...args),
}));

// Mock useStoredInterval to return a controlled value
const mockStoredIntervals: Record<string, number> = {
  pill: 1000,
  compact: 1000,
  hud: 1000,
};

vi.mock("@/hooks/useStoredInterval", () => ({
  useStoredInterval: (label: string) => mockStoredIntervals[label] ?? 1000,
}));

// ── Test Helpers ───────────────────────────────────────────────────────────

function resetStores() {
  useNetworkStore.setState({
    data: { uploadBytesPerSec: 0, downloadBytesPerSec: 0, interfaceName: "" },
    isConnected: false,
    isInitialized: false,
    lastError: null,
    peakUpload: 0,
    peakDownload: 0,
    history: [],
    todayUploadBytes: 0,
    todayDownloadBytes: 0,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useNetworkPoller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStores();
    mockPollNetworkData.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Pill / HUD path ──────────────────────────────────────────────────

  describe("pill/hud window (lightweight stats)", () => {
    beforeEach(() => {
      mockWindowLabel = "pill";
    });

    it("calls pollNetworkData with the correct window label", async () => {
      mockPollNetworkData.mockResolvedValue({
        currentUpload: 1000,
        currentDownload: 5000,
        liveData: {
          uploadBytesPerSec: 1000,
          downloadBytesPerSec: 5000,
          interfaceName: "eth0",
        },
      });

      renderHook(() => useNetworkPoller());

      await waitFor(() => {
        expect(mockPollNetworkData).toHaveBeenCalledWith("pill");
      });
    });

    it("sets data and isConnected on successful poll", async () => {
      mockPollNetworkData.mockResolvedValue({
        currentUpload: 1024,
        currentDownload: 2048,
        liveData: {
          uploadBytesPerSec: 1024,
          downloadBytesPerSec: 2048,
          interfaceName: "Wi-Fi",
        },
      });

      renderHook(() => useNetworkPoller());

      await waitFor(() => {
        const state = useNetworkStore.getState();
        expect(state.data.uploadBytesPerSec).toBe(1024);
        expect(state.data.downloadBytesPerSec).toBe(2048);
        expect(state.data.interfaceName).toBe("Wi-Fi");
        expect(state.isConnected).toBe(true);
        expect(state.isInitialized).toBe(true);
      });
    });

    it("sets lastError on poll failure", async () => {
      mockPollNetworkData.mockRejectedValue(
        new Error("IPC timeout: get_network_stats"),
      );

      renderHook(() => useNetworkPoller());

      await waitFor(() => {
        const state = useNetworkStore.getState();
        expect(state.lastError).toBe("IPC timeout: get_network_stats");
        expect(state.isConnected).toBe(false);
      });
    });

    it("polls at the configured interval", async () => {
      mockPollNetworkData.mockResolvedValue({
        currentUpload: 0,
        currentDownload: 0,
        liveData: {
          uploadBytesPerSec: 0,
          downloadBytesPerSec: 0,
          interfaceName: "eth0",
        },
      });

      renderHook(() => useNetworkPoller());

      // Initial poll
      await waitFor(() => {
        expect(mockPollNetworkData).toHaveBeenCalledTimes(1);
      });

      // Advance by interval
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockPollNetworkData).toHaveBeenCalledTimes(2);
      });
    });

    it("does NOT call setSnapshot for pill window", async () => {
      mockPollNetworkData.mockResolvedValue({
        currentUpload: 500,
        currentDownload: 1000,
        liveData: {
          uploadBytesPerSec: 500,
          downloadBytesPerSec: 1000,
          interfaceName: "eth0",
        },
      });

      renderHook(() => useNetworkPoller());

      await waitFor(() => {
        const state = useNetworkStore.getState();
        // liveData path uses setData, not setSnapshot
        expect(state.peakUpload).toBe(0); // Not set by setData
        expect(state.peakDownload).toBe(0);
        expect(state.history).toEqual([]);
      });
    });
  });

  // ── Dashboard / Compact path ─────────────────────────────────────────

  describe("dashboard/compact window (full snapshot)", () => {
    beforeEach(() => {
      mockWindowLabel = "main";
    });

    it("calls pollNetworkData with 'main' label", async () => {
      mockPollNetworkData.mockResolvedValue({
        currentUpload: 2000,
        currentDownload: 8000,
        snapshot: {
          peakUpload: 5000,
          peakDownload: 20000,
          interfaceName: "Ethernet",
          isConnected: true,
          history: [{ upload: 100, download: 200, t: 1 }],
        },
      });

      renderHook(() => useNetworkPoller());

      await waitFor(() => {
        expect(mockPollNetworkData).toHaveBeenCalledWith("main");
      });
    });

    it("calls setSnapshot with full data for dashboard window", async () => {
      const mockHistory = [
        { upload: 100, download: 200, t: 1 },
        { upload: 150, download: 250, t: 2 },
      ];

      mockPollNetworkData.mockResolvedValue({
        currentUpload: 2000,
        currentDownload: 8000,
        snapshot: {
          peakUpload: 5000,
          peakDownload: 20000,
          interfaceName: "Ethernet",
          isConnected: true,
          history: mockHistory,
        },
      });

      renderHook(() => useNetworkPoller());

      await waitFor(() => {
        const state = useNetworkStore.getState();
        expect(state.data.uploadBytesPerSec).toBe(2000);
        expect(state.data.downloadBytesPerSec).toBe(8000);
        expect(state.data.interfaceName).toBe("Ethernet");
        expect(state.peakUpload).toBe(5000);
        expect(state.peakDownload).toBe(20000);
        expect(state.history).toEqual(mockHistory);
        expect(state.isConnected).toBe(true);
        expect(state.isInitialized).toBe(true);
      });
    });

    it("respects is_connected=false from backend snapshot", async () => {
      mockPollNetworkData.mockResolvedValue({
        currentUpload: 0,
        currentDownload: 0,
        snapshot: {
          peakUpload: 0,
          peakDownload: 0,
          interfaceName: "",
          isConnected: false,
          history: [],
        },
      });

      renderHook(() => useNetworkPoller());

      await waitFor(() => {
        const state = useNetworkStore.getState();
        expect(state.isConnected).toBe(false);
      });
    });

    it("uses dashboard interval from settingsStore", async () => {
      useSettingsStore.setState({ pollIntervalMs: 2000 });

      mockPollNetworkData.mockResolvedValue({
        currentUpload: 0,
        currentDownload: 0,
        snapshot: {
          peakUpload: 0,
          peakDownload: 0,
          interfaceName: "eth0",
          isConnected: true,
          history: [],
        },
      });

      renderHook(() => useNetworkPoller());

      await waitFor(() => {
        expect(mockPollNetworkData).toHaveBeenCalledTimes(1);
      });

      // Should NOT poll at 1000ms
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(mockPollNetworkData).toHaveBeenCalledTimes(1);

      // SHOULD poll at 2000ms
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockPollNetworkData).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ── Daily usage accumulation ──────────────────────────────────────────

  describe("daily usage accumulation", () => {
    beforeEach(() => {
      mockWindowLabel = "pill";
    });

    it("accumulates today bytes after second poll", async () => {
      mockPollNetworkData.mockResolvedValue({
        currentUpload: 1000, // 1000 B/s
        currentDownload: 2000, // 2000 B/s
        liveData: {
          uploadBytesPerSec: 1000,
          downloadBytesPerSec: 2000,
          interfaceName: "eth0",
        },
      });

      renderHook(() => useNetworkPoller());

      // First poll — sets lastSampleAt but no accumulation yet
      await waitFor(() => {
        expect(useNetworkStore.getState().isInitialized).toBe(true);
      });

      // Second poll — should accumulate based on elapsed time
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        const state = useNetworkStore.getState();
        // After 1 second at 1000 B/s upload = ~1000 bytes accumulated
        expect(state.todayUploadBytes).toBeGreaterThan(0);
        expect(state.todayDownloadBytes).toBeGreaterThan(0);
      });
    });
  });

  // ── Error recovery ────────────────────────────────────────────────────

  describe("error recovery", () => {
    beforeEach(() => {
      mockWindowLabel = "pill";
    });

    it("clears error on next successful poll", async () => {
      // First poll fails
      mockPollNetworkData.mockRejectedValueOnce(new Error("Network error"));

      renderHook(() => useNetworkPoller());

      await waitFor(() => {
        expect(useNetworkStore.getState().lastError).toBe("Network error");
      });

      // Second poll succeeds
      mockPollNetworkData.mockResolvedValue({
        currentUpload: 100,
        currentDownload: 200,
        liveData: {
          uploadBytesPerSec: 100,
          downloadBytesPerSec: 200,
          interfaceName: "eth0",
        },
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        const state = useNetworkStore.getState();
        expect(state.lastError).toBeNull();
        expect(state.isConnected).toBe(true);
      });
    });
  });

  // ── Cleanup ───────────────────────────────────────────────────────────

  describe("cleanup", () => {
    beforeEach(() => {
      mockWindowLabel = "pill";
    });

    it("clears interval on unmount", async () => {
      mockPollNetworkData.mockResolvedValue({
        currentUpload: 0,
        currentDownload: 0,
        liveData: {
          uploadBytesPerSec: 0,
          downloadBytesPerSec: 0,
          interfaceName: "eth0",
        },
      });

      const { unmount } = renderHook(() => useNetworkPoller());

      await waitFor(() => {
        expect(mockPollNetworkData).toHaveBeenCalledTimes(1);
      });

      unmount();

      // After unmount, advancing time should NOT trigger more polls
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockPollNetworkData).toHaveBeenCalledTimes(1);
    });
  });
});
