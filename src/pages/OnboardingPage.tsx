import { useCallback, useState, type ReactNode } from "react";
import { Check, MonitorDown, Power } from "lucide-react";
import { invoke } from "@/api";
import { cacheHudDesign, invokeWithTimeout, setStorageItem } from "@/utils";
import { WIDGET_VIEWS, WidgetPreview } from "@/components";
import type { HudDesign } from "@/components/HudPresentation";
import {
  Button,
  CheckMark,
  SettingsCard,
  ToggleSwitch,
  cx,
} from "@/components/fluent";

type WidgetStyle = "pill" | "compact" | "hud";
type Step = "welcome" | "widgets" | "startup" | "done";

// No adapter step: FluxNet follows the adapter Windows uses for the internet
// (see Network adapters to pick one by hand).
const STEPS: Step[] = ["welcome", "widgets", "startup", "done"];
/** Steps that count towards "Step n of 2". */
const NUMBERED: Step[] = ["widgets", "startup"];

const WIDGET_CHOICES: { id: WidgetStyle; name: string; description: string }[] =
  [
    {
      id: "pill",
      name: "Pill",
      description: "Download and upload speed in a slim bar",
    },
    {
      id: "compact",
      name: "Compact",
      description: "Speeds, connection and today's totals",
    },
    {
      id: "hud",
      name: "Game overlay",
      description: "Speed, ping and packet loss",
    },
  ];

const LAYOUT_OPTIONS: { value: HudDesign; label: string }[] = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
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
          <p className="mt-1 mb-0 max-w-[520px] text-body text-fg-secondary">
            {description}
          </p>
        )}
        <div className="mt-6">{children}</div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-divider bg-card-secondary px-10 py-4">
        {footer}
      </div>
    </div>
  );
}

/** Small two-way switch shown on the game overlay's card. */
function LayoutSwitch({
  value,
  onChange,
}: {
  value: HudDesign;
  onChange: (value: HudDesign) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Game overlay layout"
      className="flex gap-0.5 rounded-control border border-control-stroke bg-control-solid p-0.5 shadow-card"
    >
      {LAYOUT_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cx(
              "h-6 rounded-[3px] px-2.5 text-caption transition-colors duration-[83ms]",
              selected
                ? "bg-accent text-on-accent"
                : "text-fg-secondary hover:bg-subtle-hover hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [widgets, setWidgets] = useState<Set<WidgetStyle>>(new Set(["pill"]));
  const [hudDesign, setHudDesign] = useState<HudDesign>("horizontal");
  const [startWithWindows, setStartWithWindows] = useState(true);
  const [keepRunning, setKeepRunning] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const go = (direction: 1 | -1) =>
    setStep(
      (s) =>
        STEPS[
          Math.min(STEPS.length - 1, Math.max(0, STEPS.indexOf(s) + direction))
        ],
    );

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
      await invoke(
        startWithWindows
          ? "plugin:autostart|enable"
          : "plugin:autostart|disable",
      ).catch(() => {});
      await invokeWithTimeout("set_minimize_to_tray", { enabled: keepRunning });
      // Save the HUD layout before showing widgets so a new HUD window opens
      // at the chosen layout's size.
      await invokeWithTimeout("set_hud_design", { design: hudDesign })
        .then(() => cacheHudDesign(hudDesign))
        .catch(() => {});
      await Promise.all(
        (["pill", "compact", "hud"] as WidgetStyle[]).map((label) =>
          invokeWithTimeout("set_widget_visibility", {
            label,
            visible: widgets.has(label),
          }).catch(() => {}),
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
  }, [startWithWindows, keepRunning, hudDesign, widgets]);

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
          <img
            src="/branding/logo.png"
            alt=""
            className="mb-4 size-28 object-contain"
          />
          <h1 className="font-display text-title font-semibold">
            Welcome to FluxNet
          </h1>
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

    case "widgets":
      content = (
        <StepFrame
          step={step}
          title="Add widgets to your desktop"
          description="Widgets float over your other windows. Turn them on or off at any time in Widgets."
          footer={
            <>
              {back}
              <Button
                variant="accent"
                className="min-w-24"
                onClick={() => go(1)}
              >
                Next
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            {WIDGET_CHOICES.map((choice) => {
              const checked = widgets.has(choice.id);
              return (
                <div
                  key={choice.id}
                  className={cx(
                    "relative flex flex-col overflow-hidden rounded-card border bg-card transition-colors duration-[83ms] hover:bg-control-hover",
                    checked ? "border-accent" : "border-card-stroke",
                  )}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleWidget(choice.id)}
                    className="flex flex-1 flex-col text-left"
                  >
                    <span
                      className={cx(
                        "flex h-[176px] w-full items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#d9e3ee,#e8e0ea)] in-data-[theme=dark]:bg-[linear-gradient(135deg,#1d2733,#2a2230)]",
                        // Leave room for the layout switch below the preview.
                        choice.id === "hud" && "pb-8",
                      )}
                    >
                      {/* Slightly reduced so the widest (the horizontal
                          overlay) fits the narrowest card. */}
                      <span className="scale-[0.85]">
                        <WidgetPreview
                          view={WIDGET_VIEWS[choice.id]}
                          colorMode="system"
                          hudDesign={
                            choice.id === "hud" ? hudDesign : undefined
                          }
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
                  {/* Inside the card, over the preview, so choosing the
                      overlay never pushes content below the fold. */}
                  {choice.id === "hud" && (
                    <div className="absolute top-[140px] left-1/2 -translate-x-1/2">
                      <LayoutSwitch
                        value={hudDesign}
                        onChange={(design) => {
                          setHudDesign(design);
                          if (!checked) toggleWidget("hud");
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
        "Measures the adapter Windows uses for the internet",
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
                <Check
                  className="size-4 shrink-0 text-success"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
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
