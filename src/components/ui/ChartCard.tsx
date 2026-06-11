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
    <div className="mb-6">
      <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.08em] mb-3">
        {title}
      </div>
      <div className="bg-panel border border-border rounded-lg p-5">
        <div className="text-[12px] text-text-muted font-normal mb-4">
          {subtitle}
        </div>
        {children}
      </div>
    </div>
  );
}
