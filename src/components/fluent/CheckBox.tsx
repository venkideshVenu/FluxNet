import { Check } from "lucide-react";
import { cx } from "./cx";

/** The visual part of a WinUI CheckBox (the clickable row supplies the role). */
export function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex size-5 shrink-0 items-center justify-center rounded-control border transition-colors duration-[83ms]",
        checked ? "border-transparent bg-accent text-on-accent" : "border-control-strong bg-control-alt",
      )}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  );
}
