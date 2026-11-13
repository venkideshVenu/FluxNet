import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "standard" | "accent" | "subtle";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  /** Square button that only shows its icon (needs an aria-label). */
  iconOnly?: boolean;
};

const VARIANTS: Record<ButtonVariant, string> = {
  standard:
    "bg-control border-control-stroke border-b-control-stroke-bottom text-fg hover:bg-control-hover active:bg-control-pressed active:text-fg-secondary disabled:bg-control-disabled disabled:text-fg-disabled",
  accent:
    "bg-accent border-transparent text-on-accent hover:bg-accent-hover active:bg-accent-pressed disabled:bg-control-disabled disabled:text-fg-disabled",
  subtle:
    "bg-transparent border-transparent text-fg hover:bg-subtle-hover active:bg-subtle-pressed active:text-fg-secondary disabled:text-fg-disabled",
};

/** WinUI Button: 32px tall, 4px corners, standard / accent / subtle styles. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "standard", icon, iconOnly, className, children, type, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cx(
          "inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-control border text-body whitespace-nowrap transition-colors duration-[83ms] disabled:pointer-events-none",
          iconOnly ? "w-8 px-0" : "px-3",
          VARIANTS[variant],
          className,
        )}
        {...rest}
      >
        {icon && (
          <span className="inline-flex size-4 items-center justify-center [&>svg]:size-4">
            {icon}
          </span>
        )}
        {children}
      </button>
    );
  },
);
