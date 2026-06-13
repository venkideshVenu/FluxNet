export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <div
      className={`w-10 h-5.5 rounded-full flex items-center p-0.75 cursor-pointer transition-all shrink-0 ${
        checked
          ? "bg-accent shadow-[0_0_0_1px_var(--accent),0_2px_8px_rgba(124,111,247,0.3)]"
          : "bg-border-strong shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
      }`}
      onClick={onChange}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange();
        }
      }}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
    >
      <div
        className={`w-4 h-4 rounded-full bg-white transition-all shadow-[0_1px_3px_rgba(0,0,0,0.2)] ${
          checked ? "translate-x-4.5" : "translate-x-0"
        }`}
      />
    </div>
  );
}
