import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Bluetooth,
  Cable,
  Network,
  RefreshCw,
  Route,
  Shield,
  Smartphone,
  Sparkles,
  Usb,
  Monitor,
  Wifi,
} from "lucide-react";
import { useNetworkStore } from "@/store";
import {
  formatLinkSpeed,
  getStorageItem,
  invokeWithTimeout,
  setStorageItem,
} from "@/utils";
import {
  Button,
  Card,
  InfoBar,
  Page,
  PageHeader,
  ProgressRing,
  RadioDot,
  SettingsCard,
  SettingsGroup,
  ToggleSwitch,
  cx,
} from "@/components/fluent";

export type InterfaceInfo = {
  name: string;
  description: string;
  if_index: number;
  status: string;
  mac: string;
  link_speed_bps: number;
  interface_type: string;
};

const POLL_INTERVAL_MS = 3000;

const TYPE_LABELS: Record<string, string> = {
  wifi: "Wi-Fi",
  ethernet: "Ethernet",
  usb: "USB tethering",
  bluetooth: "Bluetooth",
  cellular: "Cellular",
  vpn: "VPN",
  virtual: "Virtual",
  tunnel: "Tunnel",
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type.toLowerCase()] ?? "Other";
}

export function adapterIcon(type: string) {
  switch (type.toLowerCase()) {
    case "wifi":
      return <Wifi />;
    case "ethernet":
      return <Cable />;
    case "usb":
      return <Usb />;
    case "bluetooth":
      return <Bluetooth />;
    case "cellular":
      return <Smartphone />;
    case "vpn":
      return <Shield />;
    case "virtual":
      return <Monitor />;
    case "tunnel":
      return <Route />;
    default:
      return <Network />;
  }
}

export const isUp = (i: InterfaceInfo) => i.status.toLowerCase() === "up";

/** The adapter automatic mode picks: connected Ethernet/Wi-Fi first. */
export function pickAutomatic(
  list: InterfaceInfo[],
): InterfaceInfo | undefined {
  return (
    list.find(
      (i) =>
        isUp(i) &&
        ["ethernet", "wifi"].includes(i.interface_type.toLowerCase()),
    ) ?? list.find(isUp)
  );
}

function statusText(i: InterfaceInfo): string {
  return isUp(i) ? "Connected" : i.status;
}

export function InterfacesPage() {
  const currentInterface = useNetworkStore((s) => s.data.interfaceName);
  const [interfaces, setInterfaces] = useState<InterfaceInfo[] | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [automatic, setAutomatic] = useState(
    () => getStorageItem("fluxnet_interface_mode", "auto") !== "manual",
  );
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const loadInterfaces = useCallback(async () => {
    try {
      const result = await invokeWithTimeout<InterfaceInfo[]>("get_interfaces");
      setInterfaces(result);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void loadInterfaces();
    // Skip refreshes while the dashboard is hidden (minimized or in the tray).
    const id = setInterval(() => {
      if (!document.hidden) void loadInterfaces();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadInterfaces]);

  const select = useCallback(
    async (name: string) => {
      setSwitching(name);
      setSelectError(null);
      try {
        await invokeWithTimeout("set_interface", { name });
        setStorageItem("fluxnet_configured", "true");
        await loadInterfaces();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setSelectError(`Couldn't switch to ${name}. ${msg}`);
      } finally {
        setSwitching(null);
      }
    },
    [loadInterfaces],
  );

  const list = interfaces ?? [];
  const automaticPick = pickAutomatic(list);
  const sorted = [...list.filter(isUp), ...list.filter((i) => !isUp(i))];
  const inUse = list.find((i) => i.name === currentInterface);

  // In automatic mode, follow the best connected adapter while this page is open.
  useEffect(() => {
    if (
      automatic &&
      automaticPick &&
      automaticPick.name !== currentInterface &&
      switching === null
    ) {
      void select(automaticPick.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automatic, automaticPick?.name, currentInterface]);

  const setMode = (auto: boolean) => {
    setAutomatic(auto);
    setStorageItem("fluxnet_interface_mode", auto ? "auto" : "manual");
  };

  const chooseManually = (iface: InterfaceInfo) => {
    if (!isUp(iface) || iface.name === currentInterface) return;
    setMode(false);
    void select(iface.name);
  };

  const onRowKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const step = e.key === "ArrowDown" ? 1 : -1;
    for (let i = index + step; i >= 0 && i < sorted.length; i += step) {
      if (isUp(sorted[i])) {
        rowRefs.current[i]?.focus();
        chooseManually(sorted[i]);
        return;
      }
    }
  };

  return (
    <Page>
      <PageHeader
        title="Network adapters"
        actions={
          <Button
            variant="subtle"
            icon={<RefreshCw />}
            onClick={() => void loadInterfaces()}
          >
            Refresh
          </Button>
        }
      />

      {selectError && (
        <InfoBar
          className="mb-4"
          severity="error"
          title="Couldn't switch adapters"
          message={selectError}
          onClose={() => setSelectError(null)}
        />
      )}

      <SettingsGroup>
        <SettingsCard
          icon={<Sparkles />}
          header="Choose adapter automatically"
          description={
            automaticPick
              ? `Uses the best connected adapter. Now: ${automaticPick.name}`
              : "Uses the best connected adapter"
          }
        >
          <ToggleSwitch
            label="Choose adapter automatically"
            checked={automatic}
            onChange={(v) => {
              setMode(v);
              if (
                v &&
                automaticPick &&
                automaticPick.name !== currentInterface
              ) {
                void select(automaticPick.name);
              }
            }}
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Adapters">
        {loadError && interfaces === null ? (
          <InfoBar
            severity="error"
            title="Couldn't list adapters"
            message={loadError}
            action={
              <Button onClick={() => void loadInterfaces()}>Try again</Button>
            }
          />
        ) : interfaces === null ? (
          <Card className="flex h-24 items-center justify-center">
            <ProgressRing size={24} label="Loading adapters" />
          </Card>
        ) : sorted.length === 0 ? (
          <Card className="px-4 py-6 text-center text-body text-fg-secondary">
            No network adapters found
          </Card>
        ) : (
          <div
            role="radiogroup"
            aria-label="Network adapter"
            className="flex flex-col gap-1"
          >
            {sorted.map((iface, index) => {
              const active = iface.name === currentInterface;
              const up = isUp(iface);
              const pending = switching === iface.name;
              return (
                <button
                  key={iface.name}
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-disabled={!up}
                  tabIndex={active || (!inUse && index === 0) ? 0 : -1}
                  onClick={() => chooseManually(iface)}
                  onKeyDown={(e) => onRowKeyDown(e, index)}
                  className={cx(
                    "flex min-h-[68px] w-full items-center gap-4 rounded-card border border-card-stroke bg-card px-4 py-3 text-left transition-colors duration-[83ms]",
                    up &&
                      !active &&
                      "hover:bg-control-hover active:bg-control-pressed",
                  )}
                >
                  <RadioDot checked={active} disabled={!up} />
                  <span
                    aria-hidden="true"
                    className={cx(
                      "flex size-5 shrink-0 items-center justify-center [&>svg]:size-5 [&>svg]:stroke-[1.5]",
                      up ? "text-fg" : "text-fg-disabled",
                    )}
                  >
                    {adapterIcon(iface.interface_type)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx(
                        "block truncate text-body",
                        !up && "text-fg-disabled",
                      )}
                    >
                      {iface.name}
                    </span>
                    <span
                      className={cx(
                        "block truncate text-caption",
                        up ? "text-fg-secondary" : "text-fg-disabled",
                      )}
                    >
                      {iface.description || typeLabel(iface.interface_type)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                    <span
                      className={cx(
                        "text-body",
                        up ? "text-fg" : "text-fg-disabled",
                      )}
                    >
                      {pending
                        ? "Switching…"
                        : active
                          ? "In use"
                          : statusText(iface)}
                    </span>
                    {up && iface.link_speed_bps > 0 && (
                      <span className="text-caption text-fg-secondary tabular">
                        {formatLinkSpeed(iface.link_speed_bps)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </SettingsGroup>

      {inUse && (
        <SettingsGroup title={`${inUse.name} properties`}>
          <Card className="px-4 py-3">
            <dl className="grid grid-cols-[minmax(140px,max-content)_1fr] gap-x-8 gap-y-2 text-body">
              <Property label="Description" value={inUse.description || "—"} />
              <Property label="Type" value={typeLabel(inUse.interface_type)} />
              <Property label="Status" value={statusText(inUse)} />
              <Property
                label="Link speed"
                value={
                  inUse.link_speed_bps > 0
                    ? formatLinkSpeed(inUse.link_speed_bps)
                    : "—"
                }
              />
              <Property
                label="Physical address (MAC)"
                value={inUse.mac || "—"}
              />
            </dl>
          </Card>
        </SettingsGroup>
      )}
    </Page>
  );
}

function Property({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-fg-secondary">{label}</dt>
      <dd className="m-0 select-text text-fg tabular">{value}</dd>
    </>
  );
}
