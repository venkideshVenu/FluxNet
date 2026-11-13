import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, MonitorDown, Power } from "lucide-react";
import { invoke } from "@/api";
import { cacheHudDesign, invokeWithTimeout, setStorageItem } from "@/utils";
import { WIDGET_VIEWS, WidgetPreview } from "@/components";
import type { HudDesign } from "@/components/HudPresentation";
import {
  Button,
  CheckMark,
  ComboBox,
  InfoBar,
  ProgressRing,
  RadioDot,
  SettingsCard,
  ToggleSwitch,
  cx,
} from "@/components/fluent";
import { adapterIcon, isUp, pickAutomatic, type InterfaceInfo } from "./InterfacesPage";

type WidgetStyle = "pill" | "compact" | "hud";
type Step = "welcome" | "adapter" | "widgets" | "startup" | "done";

const STEPS: Step[] = ["welcome", "adapter", "widgets", "startup", "done"];
/** Steps that count towards "Step n of 3". */
const NUMBERED: Step[] = ["adapter", "widgets", "startup"];

const WIDGET_CHOICES: { id: WidgetStyle; name: string; description: string }[] = [
  { id: "pill", name: "Pill", description: "Download and upload speed in a slim bar" },
  { id: "compact", name: "Compact", description: "Speeds, connection and today's totals" },
  { id: "hud", name: "Game overlay", description: "Speed, ping and packet loss" },
];

const LAYOUT_OPTIONS: { value: HudDesign; label: string }[] = [
  { value: "horizontal", label: "Horizontal bar" },
  { value: "vertical", label: "Vertical card" },
];

/** The frame every step shares: heading, content, and Back/Next at the bottom right. */
function StepFrame({
  step,
  title,
  description,
  children,
  footer,
}: {
  step: Step;
  title: string;
  description?: string;
  children?: ReactNode;
  footer: ReactNode;
}) {
  const number = NUMBERED.indexOf(step);
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-10 pt-9 pb-4">
        {number >= 0 && (
          <div className="mb-1 text-caption text-fg-secondary">
            Step {number + 1} of {NUMBERED.length}
          </div>
        )}
        <h1 className="font-display text-title font-semibold">{title}</h1>
        {description && (
          <p className="mt-1 mb-0 max-w-[520px] text-body text-fg-secondary">{description}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-divider bg-card-secondary px-10 py-4">
        {footer}
      </div>
    </div>
  );
}

/** A selectable row with a radio dot, used for the adapter choice. */
function ChoiceRow({
  checked,
  disabled = false,
  icon,
  title,
  detail,
  onSelect,
}: {
  checked: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  title: string;
  detail?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={() => !disabled && onSelect()}
      className={cx(
        "flex min-h-14 w-full items-center gap-4 rounded-card border border-card-stroke bg-card px-4 py-2.5 text-left transition-colors duration-[83ms]",
        !disabled && "hover:bg-control-hover active:bg-control-pressed",
      )}
    >
      <RadioDot checked={checked} disabled={disabled} />
      {icon && (
        <span
          aria-hidden="true"
          className={cx(
            "flex size-5 shrink-0 items-center justify-center [&>svg]:size-5 [&>svg]:stroke-[1.5]",
            disabled ? "text-fg-disabled" : "text-fg",
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cx("block truncate text-body", disabled && "text-fg-disabled")}>
          {title}
        </span>
        {detail && (
          <span
            className={cx(
              "block truncate text-caption",
              disabled ? "text-fg-disabled" : "text-fg-secondary",
            )}
          >
            {detail}
          </span>
        )}
      </span>
    </button>
  );
}

export function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [interfaces, setInterfaces] = useState<InterfaceInfo[]>([]);
  const [loadingIfaces, setLoadingIfaces] = useState(true);
  const [ifaceError, setIfaceError] = useState<string | null>(null);
  const [useAuto, setUseAuto] = useState(true);
  const [selectedIface, setSelectedIface] = useState("");
  const [widgets, setWidgets] = useState<Set<WidgetStyle>>(new Set(["pill"]));
  const [hudDesign, setHudDesign] = useState<HudDesign>("horizontal");
  const [startWithWindows, setStartWithWindows] = useState(true);
  const [keepRunning, setKeepRunning] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const fetched = useRef(false);

  const loadInterfaces = useCallback(async (attempts = 3) => {
    setLoadingIfaces(true);
    setIfaceError(null);
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        // The backend may still be starting on the very first launch.
        if (attempt === 0 && !fetched.current) await new Promise((r) => setTimeout(r, 500));
        const result = await invokeWithTimeout<InterfaceInfo[]>("get_interfaces", undefined, 10_000);
        setInterfaces(result);
        const best = pickAutomatic(result);
        setSelectedIface(best?.name ?? result.find(isUp)?.name ?? "");
        if (!best) setUseAuto(false);
        fetched.current = true;
        setLoadingIfaces(false);
        return;
      } catch (err) {
        console.error(`Adapter fetch attempt ${attempt + 1} failed:`, err);
        if (attempt < attempts - 1) await new Promise((r) => setTimeout(r, 1000));
      }
    }
    setIfaceError("FluxNet couldn't list your network adapters.");
    setLoadingIfaces(false);
  }, []);

  useEffect(() => {
    void loadInterfaces();
  }, [loadInterfaces]);

  const go = (direction: 1 | -1) =>
    setStep((s) => STEPS[Math.min(STEPS.length - 1, Math.max(0, STEPS.indexOf(s) + direction))]);

  const automatic = pickAutomatic(interfaces);
  const chosenAdapter = useAuto ? (automatic?.name ?? selectedIface) : selectedIface;

  const toggleWidget = (id: WidgetStyle) =>
    setWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const finish = useCallback(async () => {
    setFinishing(true);
    try {
      if (chosenAdapter) await invokeWithTimeout("set_interface", { name: chosenAdapter });
      setStorageItem("fluxnet_interface_mode", useAuto ? "auto" : "manual");
      await invoke(startWithWindows ? "plugin:autostart|enable" : "plugin:autostart|disable").catch(
        () => {},
      );
      await invokeWithTimeout("set_minimize_to_tray", { enabled: keepRunning });
      // Save the HUD layout before showing widgets so a new HUD window opens
      // at the chosen layout's size.
      await invokeWithTimeout("set_hud_design", { design: hudDesign })
        .then(() => cacheHudDesign(hudDesign))
        .catch(() => {});
      await Promise.all(
        (["pill", "compact", "hud"] as WidgetStyle[]).map((label) =>
          invokeWithTimeout("set_widget_visibility", { label, visible: widgets.has(label) }).catch(
            () => {},
          ),
        ),
      );
      await invokeWithTimeout("set_onboarding_completed");
    } catch {
      await invokeWithTimeout("set_onboarding_completed").catch(() => {});
    } finally {
      setStorageItem("fluxnet_configured", "true");
      setFinishing(false);
      setStep("done");
    }
  }, [chosenAdapter, useAuto, startWithWindows, keepRunning, hudDesign, widgets]);

  const back = (
    <Button onClick={() => go(-1)} disabled={finishing}>
      Back
    </Button>
  );

  let content: ReactNode;
  switch (step) {
    case "welcome":
      content = (
        <div className="flex h-full flex-col items-center justify-center px-10 text-center">
          <img src="/branding/logo.png" alt="" className="mb-4 size-28 object-contain" />
          <h1 className="font-display text-title font-semibold">Welcome to FluxNet</h1>
          <p className="mt-2 mb-8 max-w-[420px] text-body text-fg-secondary">
            See your network speed at a glance, and how much data you use over
            time. Setup takes less than a minute.
          </p>
          <Button variant="accent" className="min-w-32" onClick={() => go(1)}>
            Get started
          </Button>
        </div>
      );
      break;

    case "adapter":
      content = (
        <StepFrame
          step={step}
          title="Choose a network adapter"
          description="FluxNet measures the traffic on one adapter. You can change it later in Network adapters."
          footer={
            <>
              {back}
              <Button
                variant="accent"
                className="min-w-24"
                disabled={loadingIfaces || (!chosenAdapter && interfaces.length > 0)}
                onClick={() => go(1)}
              >
                Next
              </Button>
            </>
          }
        >
          {loadingIfaces ? (
            <div className="flex items-center gap-3 text-body text-fg-secondary">
              <ProgressRing size={20} label="Finding adapters" /> Finding adapters…
            </div>
          ) : ifaceError ? (
            <InfoBar
              severity="error"
              message={ifaceError}
              action={<Button onClick={() => void loadInterfaces()}>Try again</Button>}
            />
          ) : interfaces.length === 0 ? (
            <InfoBar
              severity="warning"
              message="No network adapters were found. You can choose one later in Network adapters."
            />
          ) : (
            <div role="radiogroup" aria-label="Network adapter" className="flex flex-col gap-1">
              {automatic && (
                <ChoiceRow
                  checked={useAuto}
                  title="Automatic (recommended)"
                  detail={`Uses the best connected adapter — now ${automatic.name}`}
                  onSelect={() => setUseAuto(true)}
                />
              )}
              {!automatic && (
                <InfoBar
                  className="mb-2"
                  severity="warning"
                  message="Nothing is connected right now. Pick the adapter you usually use."
                />
              )}
              {[...interfaces.filter(isUp), ...interfaces.filter((i) => !isUp(i))]
                .slice(0, 6)
                .map((iface) => (
                  <ChoiceRow
                    key={iface.name}
                    checked={!useAuto && selectedIface === iface.name}
                    disabled={!isUp(iface) && Boolean(automatic)}
                    icon={adapterIcon(iface.interface_type)}
                    title={iface.name}
                    detail={`${iface.description}${isUp(iface) ? "" : " · Not connected"}`}
                    onSelect={() => {
                      setUseAuto(false);
                      setSelectedIface(iface.name);
                    }}
                  />
                ))}
            </div>
          )}
        </StepFrame>
      );
      break;

    case "widgets":
      content = (
        <StepFrame
          step={step}
          title="Add widgets to your desktop"
          description="Widgets float over your other windows. Turn them on or off at any time in Widgets."
          footer={
            <>
              {back}
              <Button variant="accent" className="min-w-24" onClick={() => go(1)}>
                Next
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            {WIDGET_CHOICES.map((choice) => {
              const checked = widgets.has(choice.id);
              return (
                <button
                  key={choice.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggleWidget(choice.id)}
                  className={cx(
                    "flex flex-col overflow-hidden rounded-card border bg-card text-left transition-colors duration-[83ms] hover:bg-control-hover",
                    checked ? "border-accent" : "border-card-stroke",
                  )}
                >
                  <span className="flex h-[200px] w-full items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#d9e3ee,#e8e0ea)] in-data-[theme=dark]:bg-[linear-gradient(135deg,#1d2733,#2a2230)]">
                    <span className="origin-center scale-[0.8]">
                      <WidgetPreview
                        view={WIDGET_VIEWS[choice.id]}
                        colorMode="system"
                        hudDesign={choice.id === "hud" ? hudDesign : undefined}
                        frameClassName="flex items-center justify-center"
                      />
                    </span>
                  </span>
                  <span className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5">
                      <CheckMark checked={checked} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-body">{choice.name}</span>
                      <span className="block text-caption text-fg-secondary">
                        {choice.description}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {widgets.has("hud") && (
            <div className="mt-3">
              <SettingsCard header="Game overlay layout">
                <ComboBox
                  label="Game overlay layout"
                  value={hudDesign}
                  options={LAYOUT_OPTIONS}
                  onChange={setHudDesign}
                />
              </SettingsCard>
            </div>
          )}
        </StepFrame>
      );
      break;

    case "startup":
      content = (
        <StepFrame
          step={step}
          title="Keep FluxNet running"
          description="Widgets and usage history need FluxNet running in the background."
          footer={
            <>
              {back}
              <Button
                variant="accent"
                className="min-w-24"
                disabled={finishing}
                onClick={() => void finish()}
              >
                {finishing ? "Finishing…" : "Finish"}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-1">
            <SettingsCard icon={<Power />} header="Start with Windows">
              <ToggleSwitch
                label="Start with Windows"
                checked={startWithWindows}
                onChange={setStartWithWindows}
              />
            </SettingsCard>
            <SettingsCard
              icon={<MonitorDown />}
              header="Keep running in the notification area"
              description="Closing the window leaves FluxNet and its widgets running"
            >
              <ToggleSwitch
                label="Keep running in the notification area"
                checked={keepRunning}
                onChange={setKeepRunning}
              />
            </SettingsCard>
          </div>
        </StepFrame>
      );
      break;

    case "done": {
      const summary = [
        chosenAdapter ? `Measuring ${chosenAdapter}` : "Choose an adapter in Network adapters",
        widgets.size === 0
          ? "No widgets for now"
          : `${WIDGET_CHOICES.filter((w) => widgets.has(w.id))
              .map((w) => w.name)
              .join(", ")} on your desktop`,
        startWithWindows ? "Starts with Windows" : "Starts when you open it",
      ];
      content = (
        <StepFrame
          step={step}
          title="You're all set"
          footer={
            <Button
              variant="accent"
              className="min-w-32"
              onClick={() => window.location.replace("/")}
            >
              Open FluxNet
            </Button>
          }
        >
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {summary.map((line) => (
              <li key={line} className="flex items-center gap-3 text-body">
                <Check className="size-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </StepFrame>
      );
      break;
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center p-6">
      <div
        key={step}
        className={cx(
          "flex h-[min(600px,100%)] w-full flex-col overflow-hidden rounded-card border border-layer-stroke bg-layer shadow-card animate-page-in",
          step === "widgets" ? "max-w-[860px]" : "max-w-[640px]",
        )}
      >
        {content}
      </div>
    </div>
  );
}
