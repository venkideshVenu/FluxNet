import type { ReactNode } from "react";
import { cx } from "./cx";

/** Page title in the WinUI "Title" style, with optional actions on the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate font-display text-title font-semibold">{title}</h1>
        {subtitle && (
          <div className="mt-0.5 truncate text-body text-fg-secondary">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Scrollable page body with consistent padding and a max reading width. */
export function Page({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={cx(
        "mx-auto w-full px-10 pt-8 pb-10 animate-page-in",
        wide ? "max-w-[1200px]" : "max-w-[1000px]",
      )}
    >
      {children}
    </div>
  );
}

/** A plain Fluent card surface. */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-card border border-card-stroke bg-card", className)}>
      {children}
    </div>
  );
}

/** A small coloured dot used to show connection state next to text. */
export function StatusDot({
  tone,
  className,
}: {
  tone: "success" | "critical" | "neutral" | "caution";
  className?: string;
}) {
  const colour = {
    success: "bg-success",
    critical: "bg-critical",
    caution: "bg-caution",
    neutral: "bg-neutral-dot",
  }[tone];
  return (
    <span
      aria-hidden="true"
      className={cx("inline-block size-2 shrink-0 rounded-full", colour, className)}
    />
  );
}
