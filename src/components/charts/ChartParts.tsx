import type { ReactNode } from "react";

export type SeriesKey = "download" | "upload";

export const SERIES: Record<SeriesKey, { label: string; color: string }> = {
  download: { label: "Download", color: "var(--download)" },
  upload: { label: "Upload", color: "var(--upload)" },
};

/** Legend: a short line key in the series colour beside text in text colour. */
export function ChartLegend({
  keys = ["download", "upload"],
  labels,
}: {
  keys?: SeriesKey[];
  labels?: Partial<Record<SeriesKey, string>>;
}) {
  return (
    <ul className="m-0 flex list-none items-center gap-4 p-0 text-caption text-fg-secondary">
      {keys.map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-0.5 w-3 rounded-full"
            style={{ background: SERIES[key].color }}
          />
          {labels?.[key] ?? SERIES[key].label}
        </li>
      ))}
    </ul>
  );
}

/** Fluent flyout used as the chart tooltip. */
export function TooltipCard({
  title,
  rows,
}: {
  title: ReactNode;
  rows: { key: SeriesKey; label?: string; value: string }[];
}) {
  return (
    <div className="min-w-36 rounded-card border border-flyout-stroke bg-flyout px-3 py-2 shadow-flyout">
      <div className="mb-1 text-caption text-fg-secondary">{title}</div>
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2 text-body">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ background: SERIES[row.key].color }}
          />
          <span className="flex-1 text-fg-secondary">
            {row.label ?? SERIES[row.key].label}
          </span>
          <span className="font-semibold text-fg tabular">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Axis tick style shared by every chart: caption size, secondary text. */
export const AXIS_TICK = { fontSize: 12, fill: "var(--fg-secondary)" };
