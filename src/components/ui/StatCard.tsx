export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-panel border border-border rounded-lg px-4.5 py-4 transition-shadow hover:shadow-[0_2px_12px_rgba(124,111,247,0.08)]">
      <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-2">
        {label} {sub}
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-[26px] font-semibold text-text tracking-[-0.02em] tabular-nums">
          {value}
        </span>
      </div>
    </div>
  );
}
