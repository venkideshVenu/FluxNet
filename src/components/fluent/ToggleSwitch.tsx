import { cx } from "./cx";

export type ToggleSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name; required because the visible text is just "On"/"Off". */
  label: string;
  disabled?: boolean;
  /** Show "On"/"Off" next to the switch, as Windows Settings does. */
  showState?: boolean;
  onText?: string;
  offText?: string;
};

/** WinUI ToggleSwitch. */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  showState = true,
  onText = "On",
  offText = "Off",
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className="group inline-flex items-center gap-3 rounded-control disabled:pointer-events-none"
    >
      {showState && (
        <span
          className={cx(
            "min-w-6 text-right text-body",
            disabled ? "text-fg-disabled" : "text-fg",
          )}
          aria-hidden="true"
        >
          {checked ? onText : offText}
        </span>
      )}
      <span
        className={cx(
          "relative flex h-5 w-10 items-center rounded-full border transition-colors duration-[83ms]",
          checked
            ? "border-transparent bg-accent group-hover:bg-accent-hover group-active:bg-accent-pressed"
            : "border-control-strong bg-control-alt group-hover:bg-control-alt-hover",
          disabled && (checked ? "bg-control-disabled" : "border-fg-disabled"),
        )}
      >
        <span
          className={cx(
            "absolute size-3 rounded-full transition-all duration-[167ms] ease-fluent group-hover:size-3.5 group-active:w-4",
            checked
              ? "left-[calc(100%-15px)] bg-on-accent group-hover:left-[calc(100%-16px)] group-active:left-[calc(100%-18px)]"
              : "left-[3px] bg-fg-secondary group-hover:left-[2px]",
            disabled && "bg-fg-disabled",
          )}
        />
      </span>
    </button>
  );
}
