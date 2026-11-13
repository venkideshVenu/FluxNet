import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ComboBox } from "./ComboBox";
import { SelectorBar } from "./SelectorBar";
import { SettingsExpander, SettingsExpanderItem } from "./Settings";
import { ToggleSwitch } from "./ToggleSwitch";

describe("ToggleSwitch", () => {
  it("is a labelled switch that reports the next state", () => {
    const onChange = vi.fn();
    render(
      <ToggleSwitch
        label="Start with Windows"
        checked={false}
        onChange={onChange}
      />,
    );
    const sw = screen.getByRole("switch", { name: "Start with Windows" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw).toHaveTextContent("Off");
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("shows On when checked and ignores clicks when disabled", () => {
    const onChange = vi.fn();
    render(<ToggleSwitch label="x" checked disabled onChange={onChange} />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveTextContent("On");
    expect(sw).toBeDisabled();
    fireEvent.click(sw);
    expect(onChange).not.toHaveBeenCalled();
  });
});

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie" },
];

function Combo({ onChange = vi.fn() }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState("a");
  return (
    <ComboBox
      label="Letter"
      value={value}
      options={OPTIONS}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe("ComboBox", () => {
  it("shows the selected option and opens a listbox on click", () => {
    render(<Combo />);
    const button = screen.getByRole("combobox", { name: "Letter" });
    expect(button).toHaveTextContent("Alpha");
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("listbox", { name: "Letter" });
    expect(within(list).getAllByRole("option")).toHaveLength(3);
    expect(within(list).getByRole("option", { name: "Alpha" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("selects with the keyboard", () => {
    const onChange = vi.fn();
    render(<Combo onChange={onChange} />);
    const button = screen.getByRole("combobox");
    fireEvent.keyDown(button, { key: "ArrowDown" });
    const list = screen.getByRole("listbox");
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("c");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(button).toHaveTextContent("Charlie");
  });

  it("closes on Escape without changing the value", () => {
    const onChange = vi.fn();
    render(<Combo onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox"));
    const list = screen.getByRole("listbox");
    fireEvent.keyDown(list, { key: "End" });
    fireEvent.keyDown(list, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selects an option on click and closes on an outside click", () => {
    const onChange = vi.fn();
    render(<Combo onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Bravo" }));
    expect(onChange).toHaveBeenCalledWith("b");

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("SelectorBar", () => {
  it("marks the selected tab and moves with the arrow keys", () => {
    const onChange = vi.fn();
    render(
      <SelectorBar
        label="Period"
        value="today"
        onChange={onChange}
        items={[
          { value: "today", label: "Today" },
          { value: "week", label: "This week" },
        ]}
      />,
    );
    const today = screen.getByRole("tab", { name: "Today" });
    expect(today).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "This week" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    fireEvent.keyDown(today, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("week");
    fireEvent.keyDown(today, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("week");
  });
});

describe("SettingsExpander", () => {
  function Expander({ onToggle = vi.fn() }: { onToggle?: () => void }) {
    return (
      <SettingsExpander
        header="Pill"
        headerControl={
          <ToggleSwitch label="Show Pill" checked={false} onChange={onToggle} />
        }
      >
        <SettingsExpanderItem header="Opacity">slider</SettingsExpanderItem>
      </SettingsExpander>
    );
  }

  it("starts collapsed and expands from the chevron", () => {
    render(<Expander />);
    expect(screen.queryByText("Opacity")).not.toBeInTheDocument();
    const chevron = screen.getByRole("button", { name: "Expand Pill" });
    expect(chevron).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(chevron);
    expect(screen.getByText("Opacity")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse Pill" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("does not expand when the header control is used", () => {
    const onToggle = vi.fn();
    render(<Expander onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch", { name: "Show Pill" }));
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(screen.queryByText("Opacity")).not.toBeInTheDocument();
  });
});
