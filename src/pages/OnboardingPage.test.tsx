import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { OnboardingPage } from "./OnboardingPage";

describe("OnboardingPage", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  it("starts with the widgets and never asks for an adapter", async () => {
    render(<OnboardingPage />);
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));

    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Add widgets to your desktop")).toBeInTheDocument();
    expect(screen.queryByText(/network adapter/i)).not.toBeInTheDocument();
  });

  it("picking an overlay layout also adds the overlay, and is saved", async () => {
    render(<OnboardingPage />);
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));

    const overlay = screen.getByRole("checkbox", { name: /Game overlay/ });
    expect(overlay).not.toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Vertical" }));
    expect(overlay).toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: /Finish|Done/ }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("set_hud_design", {
        design: "vertical",
      }),
    );
    expect(invoke).not.toHaveBeenCalledWith("set_interface", expect.anything());
  });
});
