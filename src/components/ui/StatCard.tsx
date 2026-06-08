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
    <div className="stat-card">
      <div className="stat-label">
        {label} {sub}
      </div>
      <div className="stat-value">
        <span className="stat-num">{value}</span>
      </div>
    </div>
  );
}
