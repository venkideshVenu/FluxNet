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
      className={`w-[38px] h-[21px] rounded-[11px] flex items-center p-0.5 cursor-pointer transition-colors shrink-0 ${
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
        className={`w-[17px] h-[17px] rounded-full bg-white transition-transform shadow-[0_1px_3px_rgba(0,0,0,0.15)] ${
          checked ? "translate-x-[17px]" : "translate-x-0"
        }`}
      />
    </div>
  );
}
