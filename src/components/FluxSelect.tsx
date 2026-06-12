import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

type Option = {
  value: string;
  label: string;
};

type FluxSelectProps = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  width?: string;
};

export function FluxSelect({
  value,
  options,
  onChange,
  width = "w-[180px]",
}: FluxSelectProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [dropdownStyles, setDropdownStyles] = useState<React.CSSProperties>({});

  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected =
    options.find((option) => option.value === value) ?? options[0];

  const updateDropdownPosition = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = options.length * 44 + 8; // Approximate height
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;

    const openAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    setDropdownStyles({
      position: "fixed",
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      zIndex: 9999,
      ...(openAbove
        ? { bottom: `${window.innerHeight - rect.top + 8}px` }
        : { top: `${rect.bottom + 8}px` }),
    });
  }, [options.length]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        !ref.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
    };
  }, []);

  useEffect(() => {
    if (open) {
      const index = options.findIndex((o) => o.value === value);
      setFocusedIndex(index >= 0 ? index : 0);
      updateDropdownPosition();
    }
  }, [open, value, options, updateDropdownPosition]);

  // Update position on scroll/resize while open
  useEffect(() => {
    if (!open) return;

    const handleUpdate = () => updateDropdownPosition();

    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [open, updateDropdownPosition]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();

        if (!open) {
          setOpen(true);
        } else {
          onChange(options[focusedIndex].value);
          setOpen(false);
        }
        break;

      case "Escape":
        setOpen(false);
        break;

      case "ArrowDown":
        e.preventDefault();

        if (!open) {
          setOpen(true);
          return;
        }

        setFocusedIndex((prev) => Math.min(prev + 1, options.length - 1));
        break;

      case "ArrowUp":
        e.preventDefault();

        if (!open) {
          setOpen(true);
          return;
        }

        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;

      case "Tab":
        setOpen(false);
        break;
    }
  };

  const dropdown = open
    ? createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          style={dropdownStyles}
          className="
            overflow-hidden
            rounded-2xl
            border
            border-border
            bg-panel
            backdrop-blur-xl
            shadow-[0_12px_32px_rgba(0,0,0,0.12)]
            dark:shadow-[0_16px_40px_rgba(0,0,0,0.45)]
            animate-in
            fade-in
            zoom-in-95
            duration-200
            origin-top
          "
        >
          {options.map((option, index) => {
            const active = option.value === value;
            const focused = focusedIndex === index;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => setFocusedIndex(index)}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`
                  w-full
                  px-4
                  py-3
                  flex
                  items-center
                  justify-between
                  text-left
                  text-[13px]
                  transition-all
                  duration-150
                  ${focused ? "bg-accent-soft/40" : ""}
                  ${active ? "text-accent font-medium" : "text-text"}
                `}
              >
                <span>{option.label}</span>

                {active && (
                  <svg
                    className="w-4 h-4 text-accent"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M4 10L8 14L16 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body,
      )
    : null;

  return (
    <div
      ref={ref}
      className={`relative ${width} shrink-0`}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="
          group
          w-full
          h-11
          px-4
          rounded-xl
          border
          border-border
          bg-panel
          flex
          items-center
          justify-between
          text-[13px]
          font-medium
          text-text
          transition-all
          duration-200
          hover:border-accent/50
          hover:bg-accent-soft/20
          focus:outline-none
          focus:ring-2
          focus:ring-accent/20
          focus:border-accent
        "
      >
        <span className="truncate">{selected.label}</span>

        <svg
          className={`
            w-4
            h-4
            opacity-70
            transition-all
            duration-200
            ${open ? "rotate-180" : ""}
          `}
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {dropdown}
    </div>
  );
}
