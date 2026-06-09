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
      className={`toggle ${checked ? "on" : "off"}`}
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
      <div className="toggle-thumb" />
    </div>
  );
}
