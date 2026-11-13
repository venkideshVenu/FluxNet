import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBytes, getAdaptiveBytesUnit } from "@/utils";
import { chartTicks } from "@/utils/chartScale";
import type { Bucket } from "@/utils/usageBuckets";
import { AXIS_TICK, SERIES, TooltipCard } from "./ChartParts";

export type UsageBucket = Bucket;

function bytesText(v: number) {
  const r = formatBytes(v);
  return `${r.value} ${r.unit}`;
}

/**
 * Grouped download/upload columns over a complete time axis. Columns are
 * capped at 24px with 4px rounded tops and a 2px gap between the pair.
 */
export function UsageChart({
  buckets,
  height = 280,
  tickEvery = 1,
}: {
  buckets: Bucket[];
  height?: number;
  /** Label every n-th bucket (e.g. every 3rd hour). */
  tickEvery?: number;
}) {
  const peak = useMemo(
    () => buckets.reduce((m, b) => Math.max(m, b.download, b.upload), 0),
    [buckets],
  );
  const { divisor, unitLabel } = useMemo(
    () => getAdaptiveBytesUnit(peak),
    [peak],
  );
  const {
    ticks: yTicks,
    yMax,
    decimals,
  } = useMemo(() => chartTicks(peak / divisor), [peak, divisor]);

  const data = useMemo(
    () =>
      buckets.map((b) => ({
        ...b,
        // Future slots stay on the axis but draw nothing.
        downloadValue: b.future ? null : b.download / divisor,
        uploadValue: b.future ? null : b.upload / divisor,
      })),
    [buckets, divisor],
  );

  const ticks = useMemo(
    () => buckets.filter((_, i) => i % tickEvery === 0).map((b) => b.key),
    [buckets, tickEvery],
  );
  const labelFor = useMemo(
    () => new Map(buckets.map((b) => [b.key, b.label])),
    [buckets],
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        barGap={2}
        barCategoryGap="22%"
        margin={{ top: 8, right: 0, bottom: 0, left: 12 }}
      >
        <CartesianGrid stroke="var(--divider)" vertical={false} />
        <XAxis
          dataKey="key"
          ticks={ticks}
          interval={0}
          tickFormatter={(k: string) => labelFor.get(k) ?? ""}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--divider)" }}
        />
        <YAxis
          orientation="right"
          domain={[0, yMax]}
          ticks={yTicks}
          tickFormatter={(v: number) =>
            v === 0 ? "0" : `${Number(v).toFixed(decimals)} ${unitLabel}`
          }
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <Tooltip
          isAnimationActive={false}
          cursor={{ fill: "var(--subtle-hover)" }}
          content={({ active, payload }) => {
            const b = payload?.[0]?.payload as
              | (typeof data)[number]
              | undefined;
            if (!active || !b || b.future) return null;
            return (
              <TooltipCard
                title={b.partial ? `${b.title} (so far)` : b.title}
                rows={[
                  {
                    key: "download",
                    label: "Downloaded",
                    value: bytesText(b.download),
                  },
                  {
                    key: "upload",
                    label: "Uploaded",
                    value: bytesText(b.upload),
                  },
                ]}
              />
            );
          }}
        />
        {(["download", "upload"] as const).map((key) => (
          <Bar
            key={key}
            dataKey={`${key}Value`}
            name={SERIES[key].label}
            fill={SERIES[key].color}
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
