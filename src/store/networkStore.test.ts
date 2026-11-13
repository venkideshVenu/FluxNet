import { describe, it, expect, beforeEach } from "vitest";
import { useNetworkStore, MAX_HISTORY_POINTS } from "./networkStore";

describe("networkStore", () => {
  beforeEach(() => {
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
  });

  describe("setData", () => {
    it("sets data and marks as connected + initialized", () => {
      useNetworkStore.getState().setData({
        uploadBytesPerSec: 100,
        downloadBytesPerSec: 200,
        interfaceName: "eth0",
      });

      const state = useNetworkStore.getState();
      expect(state.data.uploadBytesPerSec).toBe(100);
      expect(state.data.downloadBytesPerSec).toBe(200);
      expect(state.data.interfaceName).toBe("eth0");
      expect(state.isConnected).toBe(true);
      expect(state.isInitialized).toBe(true);
      expect(state.lastError).toBeNull();
    });

    it("clears lastError on success", () => {
      useNetworkStore.setState({ lastError: "Previous error" });
      useNetworkStore.getState().setData({
        uploadBytesPerSec: 0,
        downloadBytesPerSec: 0,
        interfaceName: "eth0",
      });
      expect(useNetworkStore.getState().lastError).toBeNull();
    });
  });

  describe("setSnapshot", () => {
    it("sets all snapshot fields", () => {
      useNetworkStore.getState().setSnapshot({
        currentUpload: 500,
        currentDownload: 1000,
        peakUpload: 2000,
        peakDownload: 5000,
        interfaceName: "Ethernet",
        isConnected: true,
        history: [{ upload: 10, download: 20, t: 1 }],
      });

      const state = useNetworkStore.getState();
      expect(state.data.uploadBytesPerSec).toBe(500);
      expect(state.data.downloadBytesPerSec).toBe(1000);
      expect(state.peakUpload).toBe(2000);
      expect(state.peakDownload).toBe(5000);
      expect(state.data.interfaceName).toBe("Ethernet");
      expect(state.isConnected).toBe(true);
      expect(state.history).toHaveLength(1);
    });

    it("caps history at MAX_HISTORY_POINTS", () => {
      const total = MAX_HISTORY_POINTS + 200;
      const bigHistory = Array.from({ length: total }, (_, i) => ({
        upload: i,
        download: i * 2,
        t: i,
      }));

      useNetworkStore.getState().setSnapshot({
        currentUpload: 0,
        currentDownload: 0,
        peakUpload: 0,
        peakDownload: 0,
        interfaceName: "eth0",
        history: bigHistory,
      });

      expect(useNetworkStore.getState().history).toHaveLength(
        MAX_HISTORY_POINTS,
      );
      // Should keep the most recent points
      expect(useNetworkStore.getState().history[0].t).toBe(200);
    });

    it("respects isConnected=false from backend", () => {
      useNetworkStore.getState().setSnapshot({
        currentUpload: 0,
        currentDownload: 0,
        peakUpload: 0,
        peakDownload: 0,
        interfaceName: "",
        isConnected: false,
        history: [],
      });

      expect(useNetworkStore.getState().isConnected).toBe(false);
    });
  });

  describe("setError", () => {
    it("sets lastError and disconnects", () => {
      useNetworkStore.getState().setError("IPC timeout");
      const state = useNetworkStore.getState();
      expect(state.lastError).toBe("IPC timeout");
      expect(state.isConnected).toBe(false);
    });
  });

  describe("dismissError", () => {
    it("clears lastError", () => {
      useNetworkStore.setState({ lastError: "Some error" });
      useNetworkStore.getState().dismissError();
      expect(useNetworkStore.getState().lastError).toBeNull();
    });
  });

  describe("addTodayUsage", () => {
    it("accumulates positive bytes", () => {
      useNetworkStore.getState().addTodayUsage(100, 200);
      useNetworkStore.getState().addTodayUsage(50, 75);
      const state = useNetworkStore.getState();
      expect(state.todayUploadBytes).toBe(150);
      expect(state.todayDownloadBytes).toBe(275);
    });

    it("clamps negative values to zero", () => {
      useNetworkStore.getState().addTodayUsage(-100, -200);
      const state = useNetworkStore.getState();
      expect(state.todayUploadBytes).toBe(0);
      expect(state.todayDownloadBytes).toBe(0);
    });
  });

  describe("resetTodayUsage", () => {
    it("zeros out today bytes", () => {
      useNetworkStore.setState({
        todayUploadBytes: 5000,
        todayDownloadBytes: 10000,
      });
      useNetworkStore.getState().resetTodayUsage();
      const state = useNetworkStore.getState();
      expect(state.todayUploadBytes).toBe(0);
      expect(state.todayDownloadBytes).toBe(0);
    });
  });

  describe("resetPeaks", () => {
    it("zeros out peak values", () => {
      useNetworkStore.setState({ peakUpload: 99999, peakDownload: 88888 });
      useNetworkStore.getState().resetPeaks();
      const state = useNetworkStore.getState();
      expect(state.peakUpload).toBe(0);
      expect(state.peakDownload).toBe(0);
    });
  });
});
