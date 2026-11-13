import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpacitySlider } from "./WidgetSettingsPage";

function Harness({ onCommit }: { onCommit: (v: number) => void }) {
  const [value, setValue] = useState(80);
  return (
    <OpacitySlider value={value} onChange={setValue} onCommit={onCommit} />
  );
}

describe("OpacitySlider", () => {
  it("commits after keyboard changes", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const slider = screen.getByLabelText("Opacity");

    fireEvent.change(slider, { target: { value: "81" } });
    fireEvent.keyUp(slider, { key: "ArrowRight" });

    expect(onCommit).toHaveBeenCalledWith(81);
  });

  it("commits when a pointer drag ends", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    fireEvent.pointerUp(screen.getByLabelText("Opacity"));
    expect(onCommit).toHaveBeenCalledWith(80);
  });
});
