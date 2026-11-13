/** WinUI indeterminate ProgressRing. */
export function ProgressRing({
  size = 32,
  label = "Loading",
}: {
  size?: number;
  label?: string;
}) {
  const stroke = Math.max(2, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      role="progressbar"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="text-accent"
      style={{ animation: "fluent-spin 1.2s linear infinite" }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * 0.3} ${c}`}
      />
    </svg>
  );
}
