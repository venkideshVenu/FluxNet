import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const ADAPTERS = [adapter("Ethernet", "ethernet"), adapter("Wi-Fi", "wifi")];

function mockBackend(automatic: boolean) {
  vi.mocked(invoke).mockImplementation(async (cmd: string) => {
    if (cmd === "get_interfaces") return ADAPTERS;
    if (cmd === "get_interface_automatic") return automatic;
    return undefined;
  });
}

function useInterface(name: string) {
  useNetworkStore.setState((s) => ({
    data: { ...s.data, interfaceName: name },
  }));
}

const automaticSwitch = () =>
  screen.getByRole("switch", { name: "Choose adapter automatically" });

describe("InterfacesPage", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("shows the backend's mode and never switches adapters by itself", async () => {
    mockBackend(true);
    useInterface("Wi-Fi");
    render(<InterfacesPage />);

    await screen.findByText("Wi-Fi properties");
    await waitFor(() => expect(automaticSwitch()).toBeChecked());
    expect(invoke).not.toHaveBeenCalledWith("set_interface", expect.anything());
  });

  it("choosing an adapter makes it a manual choice", async () => {
    mockBackend(true);
    useInterface("Wi-Fi");
    render(<InterfacesPage />);

    await userEvent.click(
      await screen.findByRole("radio", { name: /Ethernet/ }),
    );
    expect(invoke).toHaveBeenCalledWith("set_interface", { name: "Ethernet" });
    await waitFor(() => expect(automaticSwitch()).not.toBeChecked());
  });

  it("turning automatic mode on hands the choice to the backend", async () => {
    mockBackend(false);
    useInterface("Wi-Fi");
    render(<InterfacesPage />);

    await waitFor(() => expect(automaticSwitch()).not.toBeChecked());
    await userEvent.click(automaticSwitch());
    expect(invoke).toHaveBeenCalledWith("set_interface_automatic", undefined);
    await waitFor(() => expect(automaticSwitch()).toBeChecked());
  });

  it("shows the properties of the adapter in use", async () => {
    mockBackend(false);
    useInterface("Wi-Fi");
    render(<InterfacesPage />);

    expect(await screen.findByText("Wi-Fi properties")).toBeInTheDocument();
    expect(screen.getByText("00-11-22-33-44-55")).toBeInTheDocument();
  });
});
