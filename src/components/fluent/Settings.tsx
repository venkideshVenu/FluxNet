import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cx } from "./cx";

/** A titled group of settings cards, as in Windows Settings. */
export function SettingsGroup({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={cx("flex flex-col gap-1 mt-7 first-of-type:mt-0", className)}
    >
      {title && (
        <h2 id={id} className="mb-1 px-0.5 text-body font-semibold">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

type CardContent = {
  icon?: ReactNode;
  header: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
};

function CardBody({ icon, header, description }: CardContent) {
  return (
    <>
      {icon && (
        <span
          className="flex size-5 shrink-0 items-center justify-center text-fg [&>svg]:size-5"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-body text-fg">{header}</div>
        {description && (
          <div className="text-caption text-fg-secondary">{description}</div>
        )}
      </div>
    </>
  );
}

const CARD =
  "flex min-h-[68px] w-full items-center gap-4 rounded-card border border-card-stroke bg-card px-4 py-3 text-left";

/** WinUI SettingsCard: icon, header, description and a control on the right. */
export function SettingsCard({
  icon,
  header,
  description,
  children,
  onClick,
  className,
}: CardContent & { onClick?: () => void; className?: string }) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cx(
          CARD,
          "transition-colors duration-[83ms] hover:bg-control-hover active:bg-control-pressed",
          className,
        )}
      >
        <CardBody icon={icon} header={header} description={description} />
        {children}
        <ChevronRight
          className="size-4 shrink-0 text-fg-secondary"
          aria-hidden="true"
        />
      </button>
    );
  }
  return (
    <div className={cx(CARD, className)}>
      <CardBody icon={icon} header={header} description={description} />
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  );
}

/**
 * WinUI SettingsExpander: a card whose extra settings fold out below it.
 * `headerControl` (e.g. an on/off switch) stays usable while collapsed.
 */
export function SettingsExpander({
  icon,
  header,
  description,
  headerControl,
  children,
  defaultExpanded = false,
}: CardContent & {
  headerControl?: ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // The content stays rendered while it folds away, then is removed so
  // collapsed cards cost nothing (their previews are live widgets).
  const [rendered, setRendered] = useState(defaultExpanded);
  const contentId = useId();

  const toggle = () => {
    if (!expanded) setRendered(true);
    setExpanded(!expanded);
  };

  useEffect(() => {
    if (expanded || !rendered) return;
    const id = setTimeout(() => setRendered(false), EXPAND_MS);
    return () => clearTimeout(id);
  }, [expanded, rendered]);
  return (
    <div className="flex flex-col">
      <div
        onClick={toggle}
        className={cx(
          CARD,
          "transition-colors duration-[83ms] hover:bg-control-hover",
          rendered && "rounded-b-none",
        )}
      >
        <CardBody icon={icon} header={header} description={description} />
        {headerControl && (
          <div
            className="flex shrink-0 items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {headerControl}
          </div>
        )}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${typeof header === "string" ? header : "settings"}`}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className="flex size-8 shrink-0 items-center justify-center rounded-control text-fg-secondary hover:bg-subtle-hover active:bg-subtle-pressed"
        >
          <ChevronDown
            className={cx(
              "size-4 transition-transform duration-[167ms] ease-fluent",
              expanded && "rotate-180",
            )}
          />
        </button>
      </div>
      {rendered && (
        // Animates the height: grid rows go from 0fr to 1fr (WinUI's expand
        // motion). `starting:` sets the first frame when it appears.
        <div
          inert={!expanded}
          className={cx(
            "grid transition-[grid-template-rows,opacity] duration-[250ms] ease-fluent-out",
            expanded
              ? "grid-rows-[1fr] opacity-100 starting:grid-rows-[0fr] starting:opacity-0"
              : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              id={contentId}
              className="flex flex-col rounded-b-card border border-t-0 border-card-stroke bg-card-secondary"
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Length of the expand and collapse animation, in ms. */
const EXPAND_MS = 250;

/** A row inside a SettingsExpander, indented to line up with the header text. */
export function SettingsExpanderItem({
  header,
  description,
  children,
}: {
  header: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-[52px] items-center gap-4 border-t border-divider py-2 pr-16 pl-[52px] first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="text-body">{header}</div>
        {description && (
          <div className="text-caption text-fg-secondary">{description}</div>
        )}
      </div>
      {children && <div className="flex shrink-0 items-center">{children}</div>}
    </div>
  );
}
