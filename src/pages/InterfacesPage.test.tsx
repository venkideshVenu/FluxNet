import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useNetworkStore } from "@/store";
import { InterfacesPage, type InterfaceInfo } from "./InterfacesPage";

const adapter = (name: string, type: string, status = "Up"): InterfaceInfo => ({
  name,
  description: `${name} adapter`,
  if_index: 1,
  status,
  mac: "00-11-22-33-44-55",
  link_speed_bps: 1_000_000_000,
  interface_type: type,
});

const ADAPTERS = [
  adapter("vEthernet (WSL)", "virtual"),
  adapter("Wi-Fi", "wifi"),
];

function mockBackend() {
  vi.mocked(invoke).mockImplementation(async (cmd: string) => {
    if (cmd === "get_interfaces") return ADAPTERS;
    return undefined;
  });
}

function useInterface(name: string) {
  useNetworkStore.setState((s) => ({
    data: { ...s.data, interfaceName: name },
  }));
}

describe("InterfacesPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(invoke).mockReset();
    mockBackend();
  });

  it("switches to the best adapter in automatic mode", async () => {
    useInterface("vEthernet (WSL)");
    render(<InterfacesPage />);

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("set_interface", { name: "Wi-Fi" }),
    );
  });

  it("leaves a manually chosen adapter alone", async () => {
    localStorage.setItem("fluxnet_interface_mode", "manual");
    useInterface("vEthernet (WSL)");
    render(<InterfacesPage />);

    await screen.findByText("vEthernet (WSL) properties");
    expect(invoke).not.toHaveBeenCalledWith("set_interface", expect.anything());
  });

  it("shows the properties of the adapter in use", async () => {
    localStorage.setItem("fluxnet_interface_mode", "manual");
    useInterface("Wi-Fi");
    render(<InterfacesPage />);

    expect(await screen.findByText("Wi-Fi properties")).toBeInTheDocument();
    expect(screen.getByText("00-11-22-33-44-55")).toBeInTheDocument();
  });
});
