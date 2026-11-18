import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { OnboardingPage } from "./OnboardingPage";
import type { InterfaceInfo } from "./InterfacesPage";

const WIFI: InterfaceInfo = {
  name: "Wi-Fi",
  description: "Intel Wi-Fi 6E AX211",
  if_index: 1,
  status: "Up",
  mac: "",
  link_speed_bps: 0,
  interface_type: "wifi",
};

describe("OnboardingPage adapter step", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("lists adapters and recommends the automatic choice", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) =>
      cmd === "get_interfaces" ? [WIFI] : undefined,
    );
    render(<OnboardingPage />);
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));

    expect(
      await screen.findByText("Automatic (recommended)", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Wi-Fi")).toBeInTheDocument();
  });

  it("offers a retry when adapters can't be listed, and recovers", async () => {
    let fail = true;
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd !== "get_interfaces") return undefined;
      if (fail) throw new Error("backend not ready");
      return [WIFI];
    });
    render(<OnboardingPage />);
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));

    const retry = await screen.findByRole(
      "button",
      { name: "Try again" },
      { timeout: 5000 },
    );
    fail = false;
    await userEvent.click(retry);
    expect(
      await screen.findByText("Automatic (recommended)", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  }, 10_000);
});
