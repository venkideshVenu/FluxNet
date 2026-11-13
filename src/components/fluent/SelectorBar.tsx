import { useRef, type KeyboardEvent } from "react";
import { cx } from "./cx";

export type SelectorBarItem<T extends string> = { value: T; label: string };

/** WinUI SelectorBar: text tabs with an accent pill under the selected one. */
export function SelectorBar<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: SelectorBarItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].value);
  };

  return (
    <div role="tablist" aria-label={label} className="flex items-center gap-1">
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cx(
              "relative h-10 rounded-control px-3 text-body transition-colors duration-[83ms] hover:bg-subtle-hover active:bg-subtle-pressed",
              selected ? "text-fg" : "text-fg-secondary hover:text-fg",
            )}
          >
            {item.label}
            {selected && (
              <span
                aria-hidden="true"
                className="absolute bottom-0.5 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-accent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
