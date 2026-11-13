import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, CircleX, Info, X } from "lucide-react";
import { cx } from "./cx";

export type InfoBarSeverity = "informational" | "success" | "warning" | "error";

const STYLES: Record<
  InfoBarSeverity,
  { bg: string; icon: ReactNode; role: "status" | "alert" }
> = {
  informational: {
    bg: "bg-card-secondary",
    icon: <Info className="text-accent" />,
    role: "status",
  },
  success: {
    bg: "bg-success-bg",
    icon: <CircleCheck className="text-success" />,
    role: "status",
  },
  warning: {
    bg: "bg-caution-bg",
    icon: <CircleAlert className="text-caution" />,
    role: "alert",
  },
  error: {
    bg: "bg-critical-bg",
    icon: <CircleX className="text-critical" />,
    role: "alert",
  },
};

/** WinUI InfoBar: an inline, non-modal message with an optional action. */
export function InfoBar({
  severity = "informational",
  title,
  message,
  action,
  onClose,
  className,
}: {
  severity?: InfoBarSeverity;
  title?: string;
  message: ReactNode;
  action?: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  const style = STYLES[severity];
  return (
    <div
      role={style.role}
      className={cx(
        "flex min-h-12 items-start gap-3 rounded-card border border-card-stroke py-3 pr-2 pl-4",
        style.bg,
        className,
      )}
    >
      <span className="mt-0.5 flex shrink-0 [&>svg]:size-4" aria-hidden="true">
        {style.icon}
      </span>
      <div className="min-w-0 flex-1 text-body select-text">
        {title && <span className="mr-3 font-semibold">{title}</span>}
        <span>{message}</span>
      </div>
      {action && <div className="-my-1 shrink-0">{action}</div>}
      {onClose && (
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="-my-1.5 flex size-8 shrink-0 items-center justify-center rounded-control text-fg-secondary hover:bg-subtle-hover active:bg-subtle-pressed"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
