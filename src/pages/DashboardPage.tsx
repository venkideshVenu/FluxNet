import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { fetchUsageStats } from "@/api";
import { useNetworkStore, useSettingsStore } from "@/store";
import { formatBytes, formatSpeed, invokeWithTimeout } from "@/utils";
import type { UsageStats } from "@/types";
import { SERIES, ThroughputChart, type SeriesKey } from "@/components/charts";
import {
  Button,
  Card,
  InfoBar,
  Page,
  PageHeader,
  ProgressRing,
  StatusDot,
} from "@/components/fluent";
import type { InterfaceInfo } from "./InterfacesPage";

const STATS_REFRESH_MS = 10_000;

/** The large live reading at the top of Overview. */
function LiveReading({
  series,
  bytesPerSec,
}: {
  series: SeriesKey;
  bytesPerSec: number;
}) {
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const { value, unit } = formatSpeed(bytesPerSec, displayUnits);
  return (
    <div className="min-w-[200px]">
      <div className="flex items-center gap-2 text-body text-fg-secondary">
        <span
          aria-hidden="true"
          className="h-0.5 w-3 rounded-full"
          style={{ background: SERIES[series].color }}
        />
        {SERIES[series].label}
      </div>
      <div className="mt-1 flex items-baseline gap-2 tabular" aria-live="off">
        <span className="font-display text-hero font-semibold">{value}</span>
        <span className="text-subtitle text-fg-secondary">{unit}</span>
      </div>
    </div>
  );
}

/** One cell of the figures row under the chart. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 px-4 py-3 not-first:border-l not-first:border-divider">
      <div className="truncate text-caption text-fg-secondary">{label}</div>
      <div className="mt-0.5 truncate text-body-lg font-semibold tabular">
        {value}
      </div>
    </div>
  );
}

function useUsageStats() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchUsageStats()
        .then((s) => alive && setStats(s))
        .catch(() => {});
    void load();
    const id = setInterval(() => {
      if (!document.hidden) void load();
    }, STATS_REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return stats;
}

function useAdapter(name: string) {
  const [adapter, setAdapter] = useState<InterfaceInfo | null>(null);
  useEffect(() => {
    if (!name) {
      setAdapter(null);
      return;
    }
    let alive = true;
    invokeWithTimeout<InterfaceInfo[]>("get_interfaces")
      .then(
        (list) =>
          alive && setAdapter(list.find((i) => i.name === name) ?? null),
      )
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [name]);
  return adapter;
}

export function DashboardPage() {
  const {
    data,
    isConnected,
    isInitialized,
    lastError,
    peakDownload,
    peakUpload,
    history,
    dismissError,
  } = useNetworkStore(
    useShallow((s) => ({
      data: s.data,
      isConnected: s.isConnected,
      isInitialized: s.isInitialized,
      lastError: s.lastError,
      peakDownload: s.peakDownload,
      peakUpload: s.peakUpload,
      history: s.history,
      dismissError: s.dismissError,
    })),
  );
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const navigate = useNavigate();
  const stats = useUsageStats();
  const adapter = useAdapter(data.interfaceName);

  if (!isInitialized) {
    return (
      <Page>
        <PageHeader title="Overview" />
        <div className="flex h-64 items-center justify-center">
          <ProgressRing label="Connecting to the network monitor" />
        </div>
      </Page>
    );
  }

  const speed = (v: number) => {
    const r = formatSpeed(v, displayUnits);
    return `${r.value} ${r.unit}`;
  };
  const bytes = (v: number | undefined) => {
    if (v === undefined) return "—";
    const r = formatBytes(v);
    return `${r.value} ${r.unit}`;
  };

  const hasAdapter = Boolean(data.interfaceName);
  const status = !hasAdapter ? null : isConnected ? "Connected" : "No traffic";

  return (
    <Page wide>
      <PageHeader
        title={data.interfaceName || "Overview"}
        subtitle={
          hasAdapter ? (
            <span className="inline-flex items-center gap-2">
              <StatusDot tone={isConnected ? "success" : "neutral"} />
              {status}
              {adapter?.description && (
                <span className="truncate text-fg-tertiary">
                  · {adapter.description}
                </span>
              )}
            </span>
          ) : undefined
        }
      />

      {lastError && (
        <InfoBar
          className="mb-4"
          severity="error"
          title="Monitoring stopped"
          message={lastError}
          onClose={dismissError}
        />
      )}

      {!hasAdapter && (
        <InfoBar
          className="mb-6"
          severity="informational"
          title="No network adapter selected"
          message="Choose the adapter FluxNet should measure."
          action={
            <Button variant="accent" onClick={() => navigate("/adapters")}>
              Choose adapter
            </Button>
          }
        />
      )}

      <div className="mb-6 flex flex-wrap gap-x-16 gap-y-4">
        <LiveReading series="download" bytesPerSec={data.downloadBytesPerSec} />
        <LiveReading series="upload" bytesPerSec={data.uploadBytesPerSec} />
      </div>

      <Card className="mb-4 px-5 pt-4 pb-3">
        {history.length > 1 ? (
          <ThroughputChart
            history={history}
            displayUnits={displayUnits}
            timeFormat={timeFormat}
          />
        ) : (
          <div className="flex h-[272px] flex-col items-center justify-center gap-1 text-center">
            <div className="text-body">Waiting for data</div>
            <div className="text-caption text-fg-secondary">
              The chart fills in as FluxNet measures your connection.
            </div>
          </div>
        )}
      </Card>

      <Card className="flex flex-wrap">
        <Figure label="Peak download" value={speed(peakDownload)} />
        <Figure label="Peak upload" value={speed(peakUpload)} />
        <Figure
          label="Downloaded today"
          value={bytes(stats?.todayDownloadBytes)}
        />
        <Figure label="Uploaded today" value={bytes(stats?.todayUploadBytes)} />
      </Card>
    </Page>
  );
}
