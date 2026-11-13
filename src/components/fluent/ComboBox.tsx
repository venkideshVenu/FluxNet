import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cx } from "./cx";

export type ComboBoxOption<T extends string> = { value: T; label: string };

export type ComboBoxProps<T extends string> = {
  value: T;
  options: ComboBoxOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name (the visible setting title is usually elsewhere). */
  label: string;
  disabled?: boolean;
  minWidth?: number;
};

type Placement = { left: number; top: number; width: number; maxHeight: number };

const OPTION_HEIGHT = 36;
const POPUP_PADDING = 4;

/**
 * WinUI ComboBox (non-editable). The drop-down is rendered in a portal so it
 * is never clipped by cards or scroll containers, and supports the usual
 * keyboard model: arrows, Home/End, Enter/Space, Escape and Tab.
 */
export function ComboBox<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
  minWidth = 160,
}: ComboBoxProps<T>) {
  const id = useId();
  const listId = `${id}-list`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  const place = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const height = options.length * OPTION_HEIGHT + POPUP_PADDING * 2;
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const openUp = below < Math.min(height, 200) && above > below;
    const maxHeight = Math.max(OPTION_HEIGHT * 2, openUp ? above : below);
    const shown = Math.min(height, maxHeight);
    setPlacement({
      left: rect.left,
      width: rect.width,
      top: openUp ? rect.top - shown - 4 : rect.bottom + 4,
      maxHeight,
    });
  }, [options.length]);

  const openList = useCallback(() => {
    if (disabled) return;
    setActive(selectedIndex);
    place();
    setOpen(true);
  }, [disabled, place, selectedIndex]);

  const close = useCallback((focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const option = options[index];
      if (option && option.value !== value) onChange(option.value);
      close();
    },
    [close, onChange, options, value],
  );

  // Close when clicking elsewhere or when the layout moves under us.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        !listRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        close(false);
      }
    };
    const onDismiss = () => close(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onDismiss);
    window.addEventListener("blur", onDismiss);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onDismiss);
      window.removeEventListener("blur", onDismiss);
    };
  }, [open, close]);

  useLayoutEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${active}"]`,
    );
    el?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);

  const onButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "Enter" ||
      e.key === " "
    ) {
      e.preventDefault();
      openList();
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onButtonKeyDown}
        style={{ minWidth }}
        className={cx(
          "inline-flex h-8 items-center justify-between gap-3 rounded-control border bg-control px-3 text-left text-body transition-colors duration-[83ms]",
          "border-control-stroke border-b-control-stroke-bottom hover:bg-control-hover active:bg-control-pressed",
          "disabled:pointer-events-none disabled:bg-control-disabled disabled:text-fg-disabled",
        )}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          className="size-3 shrink-0 text-fg-secondary"
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
      {open &&
        placement &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            aria-activedescendant={`${id}-opt-${active}`}
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            style={{
              left: placement.left,
              top: placement.top,
              minWidth: placement.width,
              maxHeight: placement.maxHeight,
            }}
            className="fixed z-50 overflow-y-auto rounded-card border border-flyout-stroke bg-flyout p-1 shadow-flyout animate-page-in focus-visible:shadow-flyout focus-visible:outline-none"
          >
            {options.map((option, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={option.value}
                  id={`${id}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => commit(index)}
                  className={cx(
                    "relative flex h-8 items-center rounded-control px-3 text-body whitespace-nowrap my-0.5",
                    index === active ? "bg-subtle-hover" : "",
                    isSelected && index !== active && "bg-subtle-selected",
                  )}
                >
                  {isSelected && (
                    <span
                      className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent"
                      aria-hidden="true"
                    />
                  )}
                  {option.label}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
