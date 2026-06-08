export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="chart-section">
      <div className="chart-section-title">{title}</div>
      <div className="chart-card">
        <div className="page-subtitle" style={{ marginBottom: 16 }}>
          {subtitle}
        </div>
        {children}
      </div>
    </div>
  );
}
