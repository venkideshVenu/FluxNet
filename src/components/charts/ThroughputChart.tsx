import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightToLine } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DisplayUnits } from "@/store";
import { formatSpeed, getAdaptiveChartUnit } from "@/utils";
import { chartTicks } from "@/utils/chartScale";
import { Button } from "@/components/fluent";
import { AXIS_TICK, ChartLegend, SERIES, TooltipCard } from "./ChartParts";

export type ThroughputPoint = { upload: number; download: number; t: number };

/** Points shown at once: one per second, five minutes. */
export const VISIBLE_POINTS = 300;

export function formatClock(
  ts: number,
  timeFormat: "12h" | "24h",
  seconds = false,
) {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
    hour12: timeFormat === "12h",
  });
}

/**
 * Live download/upload throughput (Task Manager style): two 2px lines with a
 * 10% wash, a solid hairline grid and the scale on the right. Drag or scroll
 * to look back through the last ten minutes.
 */
export function ThroughputChart({
  history,
  displayUnits,
  timeFormat,
  height = 240,
}: {
  history: ThroughputPoint[];
  displayUnits: DisplayUnits;
  timeFormat: "12h" | "24h";
  height?: number;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; offset: number } | null>(null);
  const container = useRef<HTMLDivElement>(null);

  const total = history.length;
  const maxOffset = Math.max(0, total - VISIBLE_POINTS);
  const clamped = Math.min(offset, maxOffset);
  const canPan = maxOffset > 0;

  const visible = useMemo(() => {
    const end = total - clamped;
    return history.slice(Math.max(0, end - VISIBLE_POINTS), end);
  }, [history, total, clamped]);

  const peak = useMemo(
    () => visible.reduce((m, p) => Math.max(m, p.upload, p.download), 0),
    [visible],
  );
  const { divisor, unitLabel } = useMemo(
    () => getAdaptiveChartUnit(peak, displayUnits),
    [peak, displayUnits],
  );
  const {
    ticks: yTicks,
    yMax,
    decimals,
  } = useMemo(() => chartTicks(peak / divisor), [peak, divisor]);

  const data = useMemo(
    () =>
      visible.map((p) => ({
        t: p.t,
        upload: p.upload / divisor,
        download: p.download / divisor,
        rawUpload: p.upload,
        rawDownload: p.download,
      })),
    [visible, divisor],
  );

  // Whole-minute ticks across the visible window.
  const ticks = useMemo(() => {
    if (data.length < 2) return [];
    const first = data[0].t;
    const last = data[data.length - 1].t;
    const out: number[] = [];
    for (let t = Math.ceil(first / 60) * 60; t <= last; t += 60) out.push(t);
    return out;
  }, [data]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canPan) return;
      setDragging(true);
      dragStart.current = { x: e.clientX, offset: clamped };
    },
    [canPan, clamped],
  );

  // Wheels and touchpads send many events per frame; each re-render redraws
  // the whole chart. Apply at most one pan per frame.
  const pendingPans = useRef<((prev: number) => number)[]>([]);
  const panFrame = useRef(0);
  const panTo = useCallback((update: (prev: number) => number) => {
    pendingPans.current.push(update);
    if (panFrame.current) return;
    panFrame.current = requestAnimationFrame(() => {
      panFrame.current = 0;
      const updates = pendingPans.current;
      pendingPans.current = [];
      setOffset((prev) => updates.reduce((value, apply) => apply(value), prev));
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(panFrame.current), []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !dragStart.current || !container.current) return;
      const perPixel = VISIBLE_POINTS / container.current.clientWidth;
      const delta = Math.round((e.clientX - dragStart.current.x) * perPixel);
      const start = dragStart.current.offset;
      panTo(() => Math.max(0, Math.min(maxOffset, start + delta)));
    },
    [dragging, maxOffset, panTo],
  );

  const endDrag = useCallback(() => {
    setDragging(false);
    dragStart.current = null;
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!canPan) return;
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      const step = Math.max(1, Math.round(Math.abs(delta) / 10));
      panTo((prev) =>
        Math.max(0, Math.min(maxOffset, prev + (delta > 0 ? -step : step))),
      );
    },
    [canPan, maxOffset, panTo],
  );

  const span = data.length > 1 ? data[data.length - 1].t - data[0].t : 0;
  const spanLabel =
    span >= 90 ? `Last ${Math.round(span / 60)} minutes` : "Last minute";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-body font-semibold">Throughput</h2>
          <span className="text-caption text-fg-secondary">
            {clamped > 0
              ? `Earlier · ${spanLabel.replace("Last ", "")}`
              : spanLabel}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {clamped > 0 && (
            <Button
              icon={<ArrowRightToLine />}
              className="h-7"
              onClick={() => setOffset(0)}
            >
              Back to now
            </Button>
          )}
          <ChartLegend />
        </div>
      </div>
      <div
        ref={container}
        role="img"
        aria-label={`Download and upload throughput, ${spanLabel.toLowerCase()}. Peak ${formatSpeed(peak, displayUnits).value} ${formatSpeed(peak, displayUnits).unit}.`}
        className={
          canPan ? (dragging ? "cursor-grabbing" : "cursor-grab") : undefined
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onWheel={onWheel}
      >
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart
            data={data}
            margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="var(--divider)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              tickFormatter={(t: number) => formatClock(t, timeFormat)}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--divider)" }}
              minTickGap={24}
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
              width={84}
            />
            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: "var(--fg-tertiary)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as
                  (typeof data)[number] | undefined;
                if (!active || !point) return null;
                const fmt = (v: number) => {
                  const r = formatSpeed(v, displayUnits);
                  return `${r.value} ${r.unit}`;
                };
                return (
                  <TooltipCard
                    title={formatClock(point.t, timeFormat, true)}
                    rows={[
                      { key: "download", value: fmt(point.rawDownload) },
                      { key: "upload", value: fmt(point.rawUpload) },
                    ]}
                  />
                );
              }}
            />
            {(["download", "upload"] as const).map((key) => (
              <Area
                key={key}
                type="monotoneX"
                dataKey={key}
                name={SERIES[key].label}
                stroke={SERIES[key].color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill={SERIES[key].color}
                fillOpacity={0.1}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: SERIES[key].color,
                  stroke: "var(--card-solid)",
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
