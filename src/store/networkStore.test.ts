import { describe, it, expect, beforeEach } from "vitest";
import { useNetworkStore } from "./networkStore";

describe("networkStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useNetworkStore.setState({
      data: { uploadBytesPerSec: 0, downloadBytesPerSec: 0, interfaceName: "" },
      isConnected: false,
      peakUpload: 0,
      peakDownload: 0,
      history: [],
      todayUploadBytes: 0,
      todayDownloadBytes: 0,
      pollIntervalMs: 1000,
      displayUnits: "auto",
    });
  });

  it("should have correct initial state", () => {
    const state = useNetworkStore.getState();
    expect(state.data.uploadBytesPerSec).toBe(0);
    expect(state.data.downloadBytesPerSec).toBe(0);
    expect(state.data.interfaceName).toBe("");
    expect(state.isConnected).toBe(false);
    expect(state.peakUpload).toBe(0);
    expect(state.peakDownload).toBe(0);
    expect(state.history).toEqual([]);
    expect(state.todayUploadBytes).toBe(0);
    expect(state.todayDownloadBytes).toBe(0);
    expect(state.pollIntervalMs).toBe(1000);
    expect(state.displayUnits).toBe("auto");
  });

  it("setData should update data and set isConnected to true", () => {
    const { setData } = useNetworkStore.getState();
    setData({
      uploadBytesPerSec: 1000,
      downloadBytesPerSec: 5000,
      interfaceName: "eth0",
    });

    const state = useNetworkStore.getState();
    expect(state.data.uploadBytesPerSec).toBe(1000);
    expect(state.data.downloadBytesPerSec).toBe(5000);
    expect(state.data.interfaceName).toBe("eth0");
    expect(state.isConnected).toBe(true);
  });

  it("setConnected should update connection state", () => {
    const { setConnected } = useNetworkStore.getState();
    setConnected(true);
    expect(useNetworkStore.getState().isConnected).toBe(true);

    setConnected(false);
    expect(useNetworkStore.getState().isConnected).toBe(false);
  });

  it("setSnapshot should update all telemetry fields", () => {
    const { setSnapshot } = useNetworkStore.getState();
    const history = [
      { upload: 100, download: 200, t: 1 },
      { upload: 150, download: 250, t: 2 },
    ];

    setSnapshot({
      currentUpload: 1024,
      currentDownload: 2048,
      peakUpload: 5000,
      peakDownload: 10000,
      interfaceName: "Wi-Fi",
      history,
    });

    const state = useNetworkStore.getState();
    expect(state.data.uploadBytesPerSec).toBe(1024);
    expect(state.data.downloadBytesPerSec).toBe(2048);
    expect(state.data.interfaceName).toBe("Wi-Fi");
    expect(state.isConnected).toBe(true);
    expect(state.peakUpload).toBe(5000);
    expect(state.peakDownload).toBe(10000);
    expect(state.history).toEqual(history);
  });

  it("addTodayUsage should accumulate bytes correctly", () => {
    const { addTodayUsage } = useNetworkStore.getState();

    addTodayUsage(100, 200);
    let state = useNetworkStore.getState();
    expect(state.todayUploadBytes).toBe(100);
    expect(state.todayDownloadBytes).toBe(200);

    addTodayUsage(50, 75);
    state = useNetworkStore.getState();
    expect(state.todayUploadBytes).toBe(150);
    expect(state.todayDownloadBytes).toBe(275);
  });

  it("addTodayUsage should not accept negative values", () => {
    const { addTodayUsage } = useNetworkStore.getState();

    addTodayUsage(-100, -200);
    const state = useNetworkStore.getState();
    expect(state.todayUploadBytes).toBe(0);
    expect(state.todayDownloadBytes).toBe(0);
  });

  it("resetTodayUsage should zero out today bytes", () => {
    const { addTodayUsage, resetTodayUsage } = useNetworkStore.getState();

    addTodayUsage(1000, 2000);
    resetTodayUsage();

    const state = useNetworkStore.getState();
    expect(state.todayUploadBytes).toBe(0);
    expect(state.todayDownloadBytes).toBe(0);
  });

  it("setPollInterval should update interval", () => {
    const { setPollInterval } = useNetworkStore.getState();
    setPollInterval(2000);
    expect(useNetworkStore.getState().pollIntervalMs).toBe(2000);
  });

  it("setDisplayUnits should update units", () => {
    const { setDisplayUnits } = useNetworkStore.getState();
    setDisplayUnits("MB/s");
    expect(useNetworkStore.getState().displayUnits).toBe("MB/s");
  });
});
