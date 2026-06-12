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
      className={`w-9.5 h-5.25 rounded-[11px] flex items-center p-0.5 cursor-pointer transition-colors shrink-0 ${
        checked ? "bg-accent" : "bg-accent-muted"
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
        className={`w-4.25 h-4.25 rounded-full bg-white transition-transform shadow-[0_1px_3px_rgba(0,0,0,0.15)] ${
          checked ? "translate-x-4.25" : "translate-x-0"
        }`}
      />
    </div>
  );
}
