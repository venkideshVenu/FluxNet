import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { invokeWithTimeout, setStorageItem } from "@/utils";

type InterfaceInfo = {
  name: string;
  description: string;
  if_index: number;
  status: string;
  mac: string;
  link_speed_bps: number;
  interface_type: string;
};

type WidgetStyle = "compact" | "pill" | "hud";

type Step = "welcome" | "interface" | "widget" | "startup" | "done";

const STEPS: Step[] = ["welcome", "interface", "widget", "startup", "done"];

export function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [interfaces, setInterfaces] = useState<InterfaceInfo[]>([]);
  const [loadingInterfaces, setLoadingInterfaces] = useState(true);
  const [selectedInterface, setSelectedInterface] = useState<string>("");
  const [selectedWidget, setSelectedWidget] = useState<WidgetStyle>("compact");
  const [startWithWindows, setStartWithWindows] = useState(true);
  const [showWidgetOnStartup, setShowWidgetOnStartup] = useState(true);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [loading, setLoading] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const progress = (stepIndex / (STEPS.length - 1)) * 100;

  // Load interfaces
  useEffect(() => {
    setLoadingInterfaces(true);
    invokeWithTimeout<InterfaceInfo[]>("get_interfaces")
      .then((result) => {
        setInterfaces(result);
        // Auto-select first Up interface
        const up = result.find((i) => i.status === "Up");
        if (up) setSelectedInterface(up.name);
      })
      .catch(console.error)
      .finally(() => setLoadingInterfaces(false));
  }, []);

  const goNext = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }, [step]);

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step]);

  const finish = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Set interface
      if (selectedInterface) {
        await invokeWithTimeout("set_interface", { name: selectedInterface });
      }

      // 2. Autostart
      if (startWithWindows) {
        await invoke("plugin:autostart|enable").catch(() => {});
      } else {
        await invoke("plugin:autostart|disable").catch(() => {});
      }

      // 3. Show selected widget
      if (showWidgetOnStartup) {
        await invokeWithTimeout("set_widget_visibility", {
          label: selectedWidget,
          visible: true,
        });
      }

      await invokeWithTimeout("set_minimize_to_tray", {
        enabled: minimizeToTray,
      });

      // catch block handle it so the backend retry actually runs.
      await invoke("set_onboarding_completed");

      // Also set localStorage as fast-path cache for next launch
      setStorageItem("fluxnet_configured", "true");

      setStep("done");
    } catch (err) {
      console.error("Onboarding finish error:", err);
      // Still mark as configured so user isn't permanently stuck
      await invoke("set_onboarding_completed").catch(() => {});
      setStorageItem("fluxnet_configured", "true");
      setStep("done");
    } finally {
      setLoading(false);
    }
  }, [
    selectedInterface,
    selectedWidget,
    startWithWindows,
    showWidgetOnStartup,
    minimizeToTray,
  ]);

  const openDashboard = useCallback(() => {
    // Force full page reload to re-evaluate the onboarding guard.
    // In Tauri's WebView this is the correct approach for resetting router state.
    window.location.replace("/");
  }, []);

  const recommendedInterface = interfaces.find(
    (i) =>
      i.status === "Up" &&
      (i.interface_type.toLowerCase() === "wifi" ||
        i.interface_type.toLowerCase() === "ethernet"),
  );

  return (
    <div className="w-full h-full flex items-center justify-center bg-bg overflow-hidden">
      <div className="w-full max-w-[420px] mx-auto">
        {step === "welcome" && (
          <WelcomeStep onNext={goNext} stepIndex={stepIndex} />
        )}
        {step === "interface" && (
          <InterfaceStep
            interfaces={interfaces}
            loading={loadingInterfaces}
            selected={selectedInterface}
            onSelect={setSelectedInterface}
            recommendedName={recommendedInterface?.name}
            onNext={goNext}
            onBack={goBack}
            stepIndex={stepIndex}
            progress={progress}
          />
        )}
        {step === "widget" && (
          <WidgetStep
            selected={selectedWidget}
            onSelect={setSelectedWidget}
            onNext={goNext}
            onBack={goBack}
            stepIndex={stepIndex}
            progress={progress}
          />
        )}
        {step === "startup" && (
          <StartupStep
            startWithWindows={startWithWindows}
            showWidgetOnStartup={showWidgetOnStartup}
            minimizeToTray={minimizeToTray}
            onToggleStart={() => setStartWithWindows(!startWithWindows)}
            onToggleWidget={() => setShowWidgetOnStartup(!showWidgetOnStartup)}
            onToggleTray={() => setMinimizeToTray(!minimizeToTray)}
            onFinish={finish}
            onBack={goBack}
            stepIndex={stepIndex}
            progress={progress}
            loading={loading}
          />
        )}
        {step === "done" && (
          <DoneStep
            interfaceName={selectedInterface}
            widgetActive={showWidgetOnStartup}
            minimizeToTray={minimizeToTray}
            onOpen={openDashboard}
            stepIndex={stepIndex}
          />
        )}
      </div>
    </div>
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-center mt-5">
      {STEPS.map((_, i) => (
        <div
          key={i}
          className={
            i === current
              ? "w-5 h-1.5 rounded-full bg-accent transition-all duration-300"
              : "w-1.5 h-1.5 rounded-full bg-border-strong transition-all duration-300"
          }
        />
      ))}
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full h-0.5 bg-border rounded-full mb-6 overflow-hidden">
      <div
        className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ── Screen 1: Welcome ─────────────────────────────────────────────────────────

function WelcomeStep({
  onNext,
  stepIndex,
}: {
  onNext: () => void;
  stepIndex: number;
}) {
  return (
    <div className="flex flex-col items-center text-center px-7 py-10">
      <div className="w-13 h-13 bg-accent rounded-[14px] flex items-center justify-center mb-5 shadow-[0_4px_16px_var(--accent-shadow)]">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      <h1 className="text-[20px] font-medium text-text tracking-[-0.02em] mb-1.5">
        Welcome to FluxNet
      </h1>
      <p className="text-[12px] text-text-muted leading-relaxed max-w-[220px] mb-7">
        Real-time network monitoring, floating right on your desktop.
      </p>
      <button
        type="button"
        onClick={onNext}
        className="bg-accent text-white border-none rounded-lg px-6 py-2.5 text-[12px] font-medium cursor-pointer hover:opacity-90 transition-opacity"
      >
        Get started
      </button>
      <StepDots current={stepIndex} />
    </div>
  );
}

// ── Screen 2: Interface ───────────────────────────────────────────────────────

function InterfaceStep({
  interfaces,
  loading,
  selected,
  onSelect,
  recommendedName,
  onNext,
  onBack,
  stepIndex,
  progress,
}: {
  interfaces: InterfaceInfo[];
  loading: boolean;
  selected: string;
  onSelect: (name: string) => void;
  recommendedName?: string;
  onNext: () => void;
  onBack: () => void;
  stepIndex: number;
  progress: number;
}) {
  const upInterfaces = interfaces.filter((i) => i.status === "Up");
  // Only show up to 2 down interfaces — they're un-selectable and just for context
  const downInterfaces = interfaces
    .filter((i) => i.status !== "Up")
    .slice(0, 2);
  const displayList = [...upInterfaces, ...downInterfaces];

  return (
    <div className="flex flex-col px-6 py-6">
      <ProgressBar progress={progress} />
      <h2 className="text-[15px] font-medium text-text mb-1">
        Select network interface
      </h2>
      <p className="text-[11px] text-text-muted mb-5">
        Choose the adapter FluxNet will monitor
      </p>

      <div className="flex flex-col gap-1.5 mb-5 max-h-[220px] overflow-y-auto scrollbar-none">
        {loading && (
          <div className="text-[12px] text-text-muted text-center py-6">
            Loading interfaces…
          </div>
        )}
        {!loading && displayList.length === 0 && (
          <div className="text-[12px] text-text-muted text-center py-6">
            No network interfaces found.
          </div>
        )}
        {displayList.map((iface) => {
          const isSelected = iface.name === selected;
          const isUp = iface.status === "Up";
          const isRecommended = iface.name === recommendedName;

          return (
            <button
              key={iface.if_index}
              type="button"
              onClick={() => isUp && onSelect(iface.name)}
              disabled={!isUp}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all w-full ${
                isSelected
                  ? "bg-accent-soft border-accent-border"
                  : "border-transparent hover:bg-panel-hover"
              } ${!isUp ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div
                className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center shrink-0 ${
                  isSelected ? "border-accent" : "border-border-strong"
                }`}
              >
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-accent" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[12px] font-medium ${isUp ? "text-text" : "text-text-muted"}`}
                >
                  {iface.name}
                </div>
                <div className="text-[10px] text-text-muted">
                  {iface.description || iface.interface_type}
                  {!isUp && " · Not connected"}
                </div>
              </div>
              {isRecommended && isUp && (
                <span className="text-[9px] font-medium bg-success-bg text-success rounded-full px-2 py-0.5 shrink-0">
                  Recommended
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mt-auto pt-4">
        <button
          type="button"
          onClick={onBack}
          className="border border-border-strong bg-transparent text-accent rounded-lg px-5 py-2.5 text-[12px] font-medium cursor-pointer hover:bg-panel-hover transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!selected}
          className="bg-accent text-white border-none rounded-lg px-5 py-2.5 text-[12px] font-medium cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      <StepDots current={stepIndex} />
    </div>
  );
}

// ── Screen 3: Widget Style ────────────────────────────────────────────────────

function WidgetStep({
  selected,
  onSelect,
  onNext,
  onBack,
  stepIndex,
  progress,
}: {
  selected: WidgetStyle;
  onSelect: (s: WidgetStyle) => void;
  onNext: () => void;
  onBack: () => void;
  stepIndex: number;
  progress: number;
}) {
  const options: {
    id: WidgetStyle;
    label: string;
    desc: string;
    preview: React.ReactNode;
  }[] = [
    {
      id: "compact",
      label: "Compact widget",
      desc: "Upload, download and daily totals",
      preview: <CompactPreview />,
    },
    {
      id: "pill",
      label: "Pill widget",
      desc: "Minimal inline bar",
      preview: <PillPreview />,
    },
    {
      id: "hud",
      label: "HUD overlay",
      desc: "For gaming and full-screen apps",
      preview: <HudPreview />,
    },
  ];

  return (
    <div className="flex flex-col px-6 py-6">
      <ProgressBar progress={progress} />
      <h2 className="text-[15px] font-medium text-text mb-1">
        Choose widget style
      </h2>
      <p className="text-[11px] text-text-muted mb-5">
        How FluxNet appears on your desktop
      </p>

      <div className="flex flex-col gap-2 mb-5 max-h-[340px] overflow-y-auto scrollbar-none">
        {options.map((opt) => {
          const isSelected = opt.id === selected;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={`flex items-start gap-2.5 px-3 py-3 rounded-lg border text-left transition-all w-full cursor-pointer ${
                isSelected
                  ? "bg-accent-soft border-accent-border"
                  : "border-transparent hover:bg-panel-hover"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center shrink-0 mt-0.5 ${
                  isSelected ? "border-accent" : "border-border-strong"
                }`}
              >
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-accent" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-text">
                  {opt.label}
                </div>
                <div className="text-[10px] text-text-muted mb-2">
                  {opt.desc}
                </div>
                <div className="bg-surface border border-border rounded-lg p-3 flex items-center justify-center min-h-[48px]">
                  {opt.preview}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mt-auto pt-4">
        <button
          type="button"
          onClick={onBack}
          className="border border-border-strong bg-transparent text-accent rounded-lg px-5 py-2.5 text-[12px] font-medium cursor-pointer hover:bg-panel-hover transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="bg-accent text-white border-none rounded-lg px-5 py-2.5 text-[12px] font-medium cursor-pointer hover:opacity-90 transition-opacity"
        >
          Next
        </button>
      </div>
      <StepDots current={stepIndex} />
    </div>
  );
}

// ── Widget Previews ───────────────────────────────────────────────────────────

function CompactPreview() {
  return (
    <div className="bg-panel border border-border rounded-[10px] px-2.5 py-2 w-[100px]">
      <div className="text-[8px] font-medium text-text-muted tracking-widest uppercase mb-1.5">
        FluxNet
      </div>
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[10px] text-net-upload">↑</span>
        <span className="text-[12px] font-medium text-text tabular-nums">
          12.4
        </span>
        <span className="text-[9px] text-text-muted">MB/s</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-net-download">↓</span>
        <span className="text-[12px] font-medium text-text tabular-nums">
          87.2
        </span>
        <span className="text-[9px] text-text-muted">MB/s</span>
      </div>
    </div>
  );
}

function PillPreview() {
  return (
    <div className="inline-flex items-center bg-panel border border-border rounded-full px-2.5 py-1 gap-2">
      <span className="text-[10px] text-net-upload">↑</span>
      <span className="text-[11px] font-medium text-text tabular-nums">
        12.4{" "}
        <span className="text-[9px] text-text-muted font-normal">MB/s</span>
      </span>
      <div className="w-px h-3 bg-border" />
      <span className="text-[10px] text-net-download">↓</span>
      <span className="text-[11px] font-medium text-text tabular-nums">
        87.2{" "}
        <span className="text-[9px] text-text-muted font-normal">MB/s</span>
      </span>
    </div>
  );
}

function HudPreview() {
  return (
    <div className="bg-[#0f0d1a] border border-[rgba(124,111,247,0.3)] rounded-lg px-2.5 py-1.5 w-[100px]">
      <div className="text-[7px] text-[rgba(180,175,255,0.5)] tracking-widest uppercase mb-1.5">
        FluxNet HUD
      </div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[8px] text-[rgba(180,175,255,0.5)]">↑ UP</span>
        <span className="text-[11px] font-medium text-[#22C97A] font-mono tabular-nums">
          12.4
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-[8px] text-[rgba(180,175,255,0.5)]">↓ DN</span>
        <span className="text-[11px] font-medium text-[#4FBBF7] font-mono tabular-nums">
          87.2
        </span>
      </div>
    </div>
  );
}

// ── Screen 4: Startup ─────────────────────────────────────────────────────────

function StartupStep({
  startWithWindows,
  showWidgetOnStartup,
  minimizeToTray,
  onToggleStart,
  onToggleWidget,
  onToggleTray,
  onFinish,
  onBack,
  stepIndex,
  progress,
  loading,
}: {
  startWithWindows: boolean;
  showWidgetOnStartup: boolean;
  minimizeToTray: boolean;
  onToggleStart: () => void;
  onToggleWidget: () => void;
  onToggleTray: () => void;
  onFinish: () => void;
  onBack: () => void;
  stepIndex: number;
  progress: number;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col px-6 py-6">
      <ProgressBar progress={progress} />
      <h2 className="text-[15px] font-medium text-text mb-1">
        Startup preferences
      </h2>
      <p className="text-[11px] text-text-muted mb-5">
        These can be changed anytime in Settings
      </p>

      <div className="bg-panel border border-border rounded-[10px] px-3 mb-4">
        <CheckRow
          checked={startWithWindows}
          onToggle={onToggleStart}
          label="Start FluxNet with Windows"
          desc="Launch automatically on login"
        />
        <CheckRow
          checked={showWidgetOnStartup}
          onToggle={onToggleWidget}
          label="Show widget on startup"
          desc="Display overlay when app launches"
        />
        <CheckRow
          checked={minimizeToTray}
          onToggle={onToggleTray}
          label="Minimize to system tray"
          desc="Keep running in the background"
          last
        />
      </div>

      <div className="flex items-start gap-2 bg-accent-soft border border-accent-border rounded-lg px-3 py-2.5 mb-4">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-accent shrink-0 mt-px"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span className="text-[11px] text-accent-strong leading-relaxed">
          FluxNet never transmits your data. All monitoring is local.
        </span>
      </div>

      <div className="flex gap-2 mt-auto pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="border border-border-strong bg-transparent text-accent rounded-lg px-5 py-2.5 text-[12px] font-medium cursor-pointer hover:bg-panel-hover transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={loading}
          className="bg-accent text-white border-none rounded-lg px-5 py-2.5 text-[12px] font-medium cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-70"
        >
          {loading ? "Setting up…" : "Finish"}
        </button>
      </div>
      <StepDots current={stepIndex} />
    </div>
  );
}

function CheckRow({
  checked,
  onToggle,
  label,
  desc,
  last = false,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  desc: string;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-start gap-2.5 py-3 w-full text-left cursor-pointer ${
        !last ? "border-b border-border" : ""
      }`}
    >
      <div
        className={`w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 mt-px transition-colors ${
          checked ? "bg-accent" : "bg-transparent border border-border-strong"
        }`}
      >
        {checked && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <div>
        <div className="text-[12px] font-medium text-text">{label}</div>
        <div className="text-[10px] text-text-muted">{desc}</div>
      </div>
    </button>
  );
}

// ── Screen 5: Done ────────────────────────────────────────────────────────────

function DoneStep({
  interfaceName,
  widgetActive,
  minimizeToTray,
  onOpen,
  stepIndex,
}: {
  interfaceName: string;
  widgetActive: boolean;
  minimizeToTray: boolean;
  onOpen: () => void;
  stepIndex: number;
}) {
  return (
    <div className="flex flex-col items-center text-center px-7 py-10">
      <div className="w-13 h-13 bg-success-bg rounded-full flex items-center justify-center mb-4">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-success"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 className="text-[20px] font-medium text-text tracking-[-0.02em] mb-1.5">
        FluxNet is ready
      </h1>
      <p className="text-[12px] text-text-muted leading-relaxed max-w-[240px] mb-5">
        {widgetActive ? (
          <>
            Your widget is active and monitoring{" "}
            <strong className="text-text">
              {interfaceName || "your network"}
            </strong>
            . It will appear on your desktop now.
          </>
        ) : (
          <>
            FluxNet is monitoring{" "}
            <strong className="text-text">
              {interfaceName || "your network"}
            </strong>
            . Open the dashboard to launch a widget.
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        {widgetActive && <StatusDot label="Widget active" />}
        {minimizeToTray && <StatusDot label="Tray icon running" />}
        <StatusDot label={`Monitoring ${interfaceName || "network"}`} />
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="bg-accent text-white border-none rounded-lg px-6 py-2.5 text-[12px] font-medium cursor-pointer hover:opacity-90 transition-opacity"
      >
        Open FluxNet
      </button>
      <StepDots current={stepIndex} />
    </div>
  );
}

function StatusDot({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
      <div className="w-1.5 h-1.5 rounded-full bg-success" />
      {label}
    </div>
  );
}

export default OnboardingPage;
