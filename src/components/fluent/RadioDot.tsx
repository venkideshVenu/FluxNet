import { cx } from "./cx";

/** The visual part of a WinUI RadioButton (the row supplies role="radio"). */
export function RadioDot({
  checked,
  disabled = false,
}: {
  checked: boolean;
  disabled?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-[83ms]",
        checked
          ? "border-transparent bg-accent"
          : "border-control-strong bg-control-alt",
        disabled && (checked ? "bg-fg-disabled" : "border-fg-disabled"),
      )}
    >
      {checked && <span className="size-2.5 rounded-full bg-on-accent" />}
    </span>
  );
}
