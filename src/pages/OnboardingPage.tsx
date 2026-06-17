import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { invokeWithTimeout, setStorageItem } from "@/utils";
import { WIDGET_VIEWS, WidgetPreview } from "@/components";
// ─── Types ────────────────────────────────────────────────────────────────────

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
type Direction = "forward" | "back";

const STEPS: Step[] = ["welcome", "interface", "widget", "startup", "done"];
const ANIM_MS = 320;

// ─── Global CSS ───────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
  @keyframes ob-slide-enter-right {
    from { opacity: 0; transform: translateX(40px) scale(0.98); }
    to   { opacity: 1; transform: translateX(0)   scale(1); }
  }
  @keyframes ob-slide-exit-left {
    from { opacity: 1; transform: translateX(0)    scale(1); }
    to   { opacity: 0; transform: translateX(-40px) scale(0.98); }
  }
  @keyframes ob-slide-enter-left {
    from { opacity: 0; transform: translateX(-40px) scale(0.98); }
    to   { opacity: 1; transform: translateX(0)     scale(1); }
  }
  @keyframes ob-slide-exit-right {
    from { opacity: 1; transform: translateX(0)   scale(1); }
    to   { opacity: 0; transform: translateX(40px) scale(0.98); }
  }

  .ob-enter-forward { animation: ob-slide-enter-right ${ANIM_MS}ms cubic-bezier(0.22,1,0.36,1) both; }
  .ob-exit-forward  { animation: ob-slide-exit-left   ${ANIM_MS}ms cubic-bezier(0.22,1,0.36,1) both; pointer-events:none; }
  .ob-enter-back    { animation: ob-slide-enter-left  ${ANIM_MS}ms cubic-bezier(0.22,1,0.36,1) both; }
  .ob-exit-back     { animation: ob-slide-exit-right  ${ANIM_MS}ms cubic-bezier(0.22,1,0.36,1) both; pointer-events:none; }

  @keyframes ob-dot-in {
    from { opacity: 0; transform: translateY(6px) scale(0.9); }
    to   { opacity: 1; transform: translateY(0)   scale(1); }
  }
  .ob-dot { animation: ob-dot-in 0.35s cubic-bezier(0.22,1,0.36,1) both; }

  @keyframes ob-check-draw {
    from { stroke-dashoffset: 24; }
    to   { stroke-dashoffset: 0; }
  }
  .ob-check { stroke-dasharray: 24; animation: ob-check-draw 0.3s ease-out 0.1s both; }

  @keyframes ob-pop {
    0%   { transform: scale(0.5);  opacity: 0; }
    70%  { transform: scale(1.12); opacity: 1; }
    100% { transform: scale(1);    opacity: 1; }
  }
  .ob-pop { animation: ob-pop 0.45s cubic-bezier(0.22,1,0.36,1) both; }

  .ob-progress { transition: width 0.45s cubic-bezier(0.22,1,0.36,1); }

  @keyframes spin { to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce) {
    .ob-enter-forward, .ob-exit-forward, .ob-enter-back, .ob-exit-back,
    .ob-dot, .ob-check, .ob-pop { animation: none !important; }
    .ob-progress { transition: none !important; }
  }
`;

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    // Read from localStorage directly – this is the source of truth
    const stored = localStorage.getItem("fluxnet_color_mode");
    if (stored === "light") return false;
    if (stored === "dark") return true;
    // If system or unset, check system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const toggle = () => {
    const nextIsDark = !isDark;
    setIsDark(nextIsDark);
    const mode = nextIsDark ? "dark" : "light";
    // Update DOM
    document.documentElement.setAttribute("data-theme", mode);
    // Persist and notify other windows (and same window)
    const oldValue = localStorage.getItem("fluxnet_color_mode");
    localStorage.setItem("fluxnet_color_mode", mode);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "fluxnet_color_mode",
        oldValue,
        newValue: mode,
        storageArea: localStorage,
        url: window.location.href,
      }),
    );
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      style={{
        position: "fixed",
        top: 10,
        right: 10,
        zIndex: 50,
        width: 32,
        height: 32,
        borderRadius: 8,
        background: "var(--panel)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background =
          "var(--panel-hover)";
        (e.currentTarget as HTMLElement).style.color = "var(--text)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--panel)";
        (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
      }}
    >
      {isDark ? (
        // Sun icon – means "switch to light"
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        // Moon icon – means "switch to dark"
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

// ─── Step Transition Hook ─────────────────────────────────────────────────────
// Keeps both old and new step in the DOM during the transition so exit and
// enter animations play simultaneously.

type StepSlot = {
  key: Step;
  direction: Direction;
  phase: "enter" | "exit";
};

function useStepTransition(step: Step, direction: Direction) {
  const [slots, setSlots] = useState<StepSlot[]>([
    { key: step, direction, phase: "enter" },
  ]);
  const prevStep = useRef(step);

  useEffect(() => {
    if (step === prevStep.current) return;
    const prev = prevStep.current;
    prevStep.current = step;

    setSlots([
      { key: prev, direction, phase: "exit" },
      { key: step, direction, phase: "enter" },
    ]);

    const t = setTimeout(() => {
      setSlots([{ key: step, direction, phase: "enter" }]);
    }, ANIM_MS + 40);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, direction]);

  return slots;
}

// ─── Step Dots ────────────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        justifyContent: "center",
      }}
    >
      {STEPS.map((_, i) => (
        <div
          key={i}
          style={{
            borderRadius: 999,
            transition:
              "width 0.3s cubic-bezier(0.22,1,0.36,1), background 0.3s, opacity 0.3s",
            width: i === current ? 20 : 6,
            height: 6,
            background: i <= current ? "var(--accent)" : "var(--border-strong)",
            opacity: i < current ? 0.4 : 1,
          }}
        />
      ))}
    </div>
  );
}

// ─── Persistent Footer ────────────────────────────────────────────────────────
// Lives OUTSIDE the animated content slot — Back/Next/Dots never move or
// animate when stepping between pages.

function PersistentFooter({
  onBack,
  onNext,
  nextLabel = "Next",
  nextDisabled = false,
  loading = false,
  showBack = true,
  stepIndex,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  showBack?: boolean;
  stepIndex: number;
}) {
  return (
    <div style={{ padding: "16px 0 0", flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {showBack && onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              border: "1px solid var(--border-strong)",
              background: "transparent",
              color: "var(--text)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.15s",
              opacity: loading ? 0.4 : 1,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--panel-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            Back
          </button>
        )}

        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || loading}
          style={{
            flex: 1,
            padding: "10px 0",
            borderRadius: 10,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: nextDisabled || loading ? "not-allowed" : "pointer",
            opacity: nextDisabled || loading ? 0.45 : 1,
            transition: "opacity 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {loading ? (
            <>
              <svg
                style={{ animation: "spin 0.8s linear infinite" }}
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Setting up…
            </>
          ) : (
            nextLabel
          )}
        </button>
      </div>
      <StepDots current={stepIndex} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [direction, setDirection] = useState<Direction>("forward");
  const [interfaces, setInterfaces] = useState<InterfaceInfo[]>([]);
  const [loadingIfaces, setLoadingIfaces] = useState(true);
  const [selectedIface, setSelectedIface] = useState("");
  const [selectedWidgets, setSelectedWidgets] = useState<Set<WidgetStyle>>(
    new Set(["compact"]),
  );
  const [startWithWindows, setStartWithWindows] = useState(true);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [ifaceError, setIfaceError] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);
  const progress = stepIndex / (STEPS.length - 1);

  const loadInterfaces = useCallback(async () => {
    setLoadingIfaces(true);
    setIfaceError(null);
    try {
      const result = await invokeWithTimeout<InterfaceInfo[]>(
        "get_interfaces",
        undefined,
        10_000, // 10s timeout
      );
      setInterfaces(result);
      const up = result.find((i) => i.status === "Up");
      if (up) setSelectedIface(up.name);
    } catch (err) {
      console.error("Failed to load interfaces:", err);
      setIfaceError("Could not detect interfaces. Please try again.");
    } finally {
      setLoadingIfaces(false);
    }
  }, []);

  useEffect(() => {
    loadInterfaces();
  }, [loadInterfaces]);

  const nav = useCallback(
    (dir: Direction) => {
      const idx = STEPS.indexOf(step);
      const next = dir === "forward" ? idx + 1 : idx - 1;
      if (next >= 0 && next < STEPS.length) {
        setDirection(dir);
        setStep(STEPS[next]);
      }
    },
    [step],
  );

  const toggleWidget = useCallback((id: WidgetStyle) => {
    setSelectedWidgets((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        if (n.size > 1) n.delete(id);
      } else n.add(id);
      return n;
    });
  }, []);

  const finish = useCallback(async () => {
    setFinishing(true);
    try {
      if (selectedIface)
        await invokeWithTimeout("set_interface", { name: selectedIface });

      await invoke(
        startWithWindows
          ? "plugin:autostart|enable"
          : "plugin:autostart|disable",
      ).catch(() => {});

      await invokeWithTimeout("set_minimize_to_tray", {
        enabled: minimizeToTray,
      });

      // Apply widget visibility choices from the widget-selection step.
      await Promise.all(
        (["compact", "pill", "hud"] as WidgetStyle[]).map((label) =>
          invokeWithTimeout("set_widget_visibility", {
            label,
            visible: selectedWidgets.has(label),
          }).catch(() => {}),
        ),
      );

      await invokeWithTimeout("set_onboarding_completed");
      setStorageItem("fluxnet_configured", "true");
    } catch {
      // At least mark onboarding done so the user isn't looped back here.
      await invokeWithTimeout("set_onboarding_completed").catch(() => {});
      setStorageItem("fluxnet_configured", "true");
    } finally {
      setFinishing(false);
      setDirection("forward");
      setStep("done");
    }
  }, [selectedIface, selectedWidgets, startWithWindows, minimizeToTray]);

  const recommendedIface = interfaces.find(
    (i) =>
      i.status === "Up" &&
      ["wifi", "ethernet"].includes(i.interface_type.toLowerCase()),
  );

  // renderStep renders ONLY the content area — no footer, no dots, no nav buttons.
  const renderStep = useCallback(
    (s: Step): React.ReactNode => {
      switch (s) {
        case "welcome":
          return <WelcomeContent />;
        case "interface":
          return (
            <InterfaceContent
              interfaces={interfaces}
              loading={loadingIfaces}
              selected={selectedIface}
              onSelect={setSelectedIface}
              recommendedName={recommendedIface?.name}
              error={ifaceError}
              onRetry={loadInterfaces}
            />
          );
        case "widget":
          return (
            <WidgetContent selected={selectedWidgets} onToggle={toggleWidget} />
          );
        case "startup":
          return (
            <StartupContent
              startWithWindows={startWithWindows}
              minimizeToTray={minimizeToTray}
              onToggleStart={() => setStartWithWindows((v) => !v)}
              onToggleTray={() => setMinimizeToTray((v) => !v)}
            />
          );
        case "done":
          return (
            <DoneContent
              interfaceName={selectedIface}
              minimizeToTray={minimizeToTray}
              selectedWidgets={selectedWidgets}
            />
          );
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      interfaces,
      loadingIfaces,
      selectedIface,
      recommendedIface,
      selectedWidgets,
      startWithWindows,
      minimizeToTray,
      toggleWidget,
      ifaceError,
      loadInterfaces,
    ],
  );

  const slots = useStepTransition(step, direction);

  // Footer configuration per step, computed from live state.
  const footerConfig = (() => {
    switch (step) {
      case "welcome":
        return {
          showBack: false,
          nextLabel: "Get started",
          nextDisabled: false,
          loading: false,
          onNext: () => nav("forward"),
        };
      case "interface": {
        const hasSelectableIface = interfaces.some((i) => i.status === "Up");
        return {
          showBack: true,
          nextLabel: "Next",
          nextDisabled: loadingIfaces || (hasSelectableIface && !selectedIface),
          loading: false,
          onBack: () => nav("back"),
          onNext: () => nav("forward"),
        };
      }
      case "widget":
        return {
          showBack: true,
          nextLabel: "Next",
          nextDisabled: selectedWidgets.size === 0,
          loading: false,
          onBack: () => nav("back"),
          onNext: () => nav("forward"),
        };
      case "startup":
        return {
          showBack: true,
          nextLabel: "Finish",
          nextDisabled: false,
          loading: finishing,
          onBack: () => nav("back"),
          onNext: finish,
        };
      case "done":
        return {
          showBack: false,
          nextLabel: "Open FluxNet",
          nextDisabled: false,
          loading: false,
          onNext: () => window.location.replace("/"),
        };
    }
  })();

  const isWidget = step === "widget";

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <ThemeToggle />

      {/* Top progress bar — fixed, always at the very top */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "var(--border)",
          zIndex: 40,
        }}
      >
        <div
          className="ob-progress"
          style={{
            height: "100%",
            background: "var(--accent)",
            width: `${Math.round(progress * 100)}%`,
          }}
        />
      </div>

      {/* Page shell */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: isWidget ? 720 : 460,
            display: "flex",
            flexDirection: "column",
            padding: "0 0 24px",
            transition: "width 0.35s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {/* ── Animated content slot ── */}
          <div
            style={{ position: "relative", height: 420, overflow: "hidden" }}
          >
            {slots.map((slot) => (
              <div
                key={`${slot.key}-${slot.phase}`}
                className={
                  slot.phase === "enter"
                    ? slot.direction === "forward"
                      ? "ob-enter-forward"
                      : "ob-enter-back"
                    : slot.direction === "forward"
                      ? "ob-exit-forward"
                      : "ob-exit-back"
                }
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  willChange: "transform, opacity",
                }}
              >
                {renderStep(slot.key)}
              </div>
            ))}
          </div>

          {/* ── Static footer ── */}
          <PersistentFooter {...footerConfig} stepIndex={stepIndex} />
        </div>
      </div>
    </>
  );
}

// ─── Screen Content Components ────────────────────────────────────────────────
// Each component fills the 420 px content slot.
// None of them render Back/Next buttons or StepDots — those live in
// PersistentFooter above and never animate.

// WELCOME ─────────────────────────────────────────────────────────────────────

function WelcomeContent() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 40px",
        transform: "translateY(20px)",
      }}
    >
      <img
        src="/branding/logo.png"
        alt="FluxNet"
        style={{
          width: 156,
          height: 156,
          objectFit: "contain",
          transform: "translateY(10px)",
          filter: "drop-shadow(0 8px 24px rgba(124,92,255,0.35))",
        }}
      />

      <h1
        style={{
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--text)",
          marginBottom: 8,
        }}
      >
        Welcome to FluxNet
      </h1>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.6,
          maxWidth: 220,
        }}
      >
        Real-time network monitoring, floating right on your desktop.
      </p>
    </div>
  );
}

// INTERFACE ───────────────────────────────────────────────────────────────────

function InterfaceContent({
  interfaces,
  loading,
  selected,
  onSelect,
  recommendedName,
  error,
  onRetry,
}: {
  interfaces: InterfaceInfo[];
  loading: boolean;
  selected: string;
  onSelect: (n: string) => void;
  recommendedName?: string;
  error?: string | null;
  onRetry: () => void;
}) {
  const up = interfaces.filter((i) => i.status === "Up");
  const down = interfaces.filter((i) => i.status !== "Up").slice(0, 2);
  const list = [...up, ...down];

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "32px 28px 0",
      }}
    >
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          color: "var(--text)",
          marginBottom: 4,
        }}
      >
        Select network interface
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        Choose the adapter FluxNet will monitor
      </p>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: "32px 0",
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            Detecting interfaces…
          </div>
        )}
        {!loading && error && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "24px 16px",
              borderRadius: 12,
              border: "1px solid var(--danger-border)",
              background: "var(--danger-bg)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--danger-text)",
              }}
            >
              {error}
            </div>
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && list.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "32px 16px",
              borderRadius: 12,
              border: "1px dashed var(--border-strong)",
              textAlign: "center",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="2.5" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  marginBottom: 4,
                }}
              >
                No active interfaces found
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  lineHeight: 1.5,
                  maxWidth: 240,
                }}
              >
                Make sure a network adapter is connected, or skip this step and
                configure it later in Settings.
              </div>
            </div>
            <button
              type="button"
              onClick={onRetry}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
          </div>
        )}
        {!loading &&
          !error &&
          list.map((iface) => {
            const isSel = iface.name === selected;
            const isUp = iface.status === "Up";
            const isRec = iface.name === recommendedName;
            return (
              <button
                key={iface.if_index}
                type="button"
                onClick={() => isUp && onSelect(iface.name)}
                disabled={!isUp}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  textAlign: "left",
                  border: `1px solid ${isSel ? "var(--accent-border)" : "var(--border)"}`,
                  background: isSel
                    ? "color-mix(in srgb, var(--accent) 15%, transparent)"
                    : "transparent",
                  opacity: !isUp ? 0.4 : 1,
                  cursor: isUp ? "pointer" : "not-allowed",
                  transition: "border-color 0.15s, background 0.15s",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  if (isUp && !isSel) {
                    e.currentTarget.style.borderColor = "var(--border-strong)";
                    e.currentTarget.style.background = "var(--panel-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSel) {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    flexShrink: 0,
                    border: `2px solid ${isSel ? "var(--accent)" : "var(--border-strong)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "border-color 0.15s",
                  }}
                >
                  {isSel && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--accent)",
                      }}
                    />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: isSel
                        ? "var(--accent)"
                        : isUp
                          ? "var(--text)"
                          : "var(--text-muted)",
                    }}
                  >
                    {iface.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-subtle)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {iface.description || iface.interface_type}
                    {!isUp && " · Not connected"}
                  </div>
                </div>

                {isRec && isUp && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      flexShrink: 0,
                      background: "var(--success-bg)",
                      color: "var(--success)",
                      border:
                        "1px solid color-mix(in srgb, var(--success) 25%, transparent)",
                    }}
                  >
                    Recommended
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}

// WIDGET ──────────────────────────────────────────────────────────────────────

const WIDGET_OPTS: { id: WidgetStyle; label: string; desc: string }[] = [
  { id: "compact", label: "Compact", desc: "Full stats & daily totals" },
  { id: "pill", label: "Pill", desc: "Minimal inline bar" },
  { id: "hud", label: "HUD", desc: "Gaming & full-screen" },
];

function WidgetContent({
  selected,
  onToggle,
}: {
  selected: Set<WidgetStyle>;
  onToggle: (id: WidgetStyle) => void;
}) {
  const hint =
    selected.size === 0
      ? "Select at least one widget"
      : selected.size === 1
        ? "1 widget selected"
        : `${selected.size} widgets selected — all will appear on your desktop`;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "32px 28px 0",
      }}
    >
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          color: "var(--text)",
          marginBottom: 4,
        }}
      >
        Choose widget style
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        Select one or more — you can enable all of them
      </p>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          alignContent: "start",
        }}
      >
        {WIDGET_OPTS.map((opt) => {
          const checked = selected.has(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onToggle(opt.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                borderRadius: 14,
                overflow: "hidden",
                border: `1px solid ${checked ? "var(--accent-border)" : "var(--border)"}`,
                boxShadow: checked ? "0 0 0 1px var(--accent-border)" : "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!checked)
                  e.currentTarget.style.borderColor = "var(--border-strong)";
              }}
              onMouseLeave={(e) => {
                if (!checked)
                  e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              <div
                data-theme="dark"
                style={{
                  height: 170,
                  background: "#0d0f14",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    transform: "scale(0.85)",
                    transformOrigin: "center center",
                  }}
                >
                  <WidgetPreview
                    view={WIDGET_VIEWS[opt.id]}
                    colorMode="dark"
                    frameClassName="flex items-center justify-center"
                    hudFrameClassName="w-[160px] aspect-[6/5]"
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  gap: 8,
                  background: checked ? "var(--accent-soft)" : "var(--panel)",
                  borderTop: `1px solid ${checked ? "var(--accent-border)" : "var(--border)"}`,
                  transition: "background 0.15s",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: checked ? "var(--accent-strong)" : "var(--text)",
                    }}
                  >
                    {opt.label}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-subtle)",
                      marginTop: 1,
                    }}
                  >
                    {opt.desc}
                  </div>
                </div>

                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    flexShrink: 0,
                    background: checked ? "var(--accent)" : "transparent",
                    border: checked
                      ? "none"
                      : "1.5px solid var(--border-strong)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.15s, border 0.15s",
                  }}
                >
                  {checked && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline className="ob-check" points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p
        style={{
          fontSize: 11,
          color: "var(--text-subtle)",
          textAlign: "center",
          paddingTop: 8,
        }}
      >
        {hint}
      </p>
    </div>
  );
}

// STARTUP ─────────────────────────────────────────────────────────────────────

function CheckRow({
  checked,
  onToggle,
  label,
  desc,
  divided = false,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  desc: string;
  divided?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        background: "transparent",
        border: "none",
        borderTop: divided ? "1px solid var(--border)" : "none",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--panel-hover)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          flexShrink: 0,
          background: checked ? "var(--accent)" : "transparent",
          border: checked ? "none" : "1.5px solid var(--border-strong)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s",
        }}
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
            <polyline className="ob-check" points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>{desc}</div>
      </div>
    </button>
  );
}

function StartupContent({
  startWithWindows,
  minimizeToTray,
  onToggleStart,
  onToggleTray,
}: {
  startWithWindows: boolean;
  minimizeToTray: boolean;
  onToggleStart: () => void;
  onToggleTray: () => void;
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "32px 28px 0",
      }}
    >
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          color: "var(--text)",
          marginBottom: 4,
        }}
      >
        Startup preferences
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        These can be changed anytime in Settings
      </p>

      <div
        style={{
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--panel)",
        }}
      >
        <CheckRow
          checked={startWithWindows}
          onToggle={onToggleStart}
          label="Start FluxNet with Windows"
          desc="Launch automatically on login"
        />

        <CheckRow
          checked={minimizeToTray}
          onToggle={onToggleTray}
          label="Minimize to system tray"
          desc="Keep running in the background"
          divided
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          marginTop: 14,
          borderRadius: 12,
          padding: "12px 14px",
          background: "var(--accent-soft)",
          border: "1px solid var(--accent-border)",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          style={{ flexShrink: 0, marginTop: 1 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span
          style={{
            fontSize: 11,
            color: "var(--accent-strong)",
            lineHeight: 1.5,
          }}
        >
          FluxNet never transmits your data. All monitoring is local.
        </span>
      </div>
    </div>
  );
}

// DONE ────────────────────────────────────────────────────────────────────────
function DoneContent({
  interfaceName,
  minimizeToTray,
  selectedWidgets,
}: {
  interfaceName: string;
  minimizeToTray: boolean;
  selectedWidgets: Set<WidgetStyle>;
}) {
  const dots = [
    ...(selectedWidgets.size
      ? [
          `${selectedWidgets.size} widget${selectedWidgets.size > 1 ? "s" : ""} selected`,
        ]
      : []),
    ...(minimizeToTray ? ["Tray icon running"] : []),
    ...(interfaceName
      ? [`Monitoring ${interfaceName}`]
      : ["Interface: configure in Settings"]),
  ];

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 40px",
      }}
    >
      <div
        className="ob-pop"
        style={{
          width: 68,
          height: 68,
          borderRadius: "50%",
          background: "var(--success-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          boxShadow:
            "0 0 0 8px color-mix(in srgb, var(--success) 12%, transparent)",
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--success)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline className="ob-check" points="20 6 9 17 4 12" />
        </svg>{" "}
      </div>

      <h1
        style={{
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--text)",
          marginBottom: 8,
        }}
      >
        FluxNet is ready
      </h1>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.6,
          maxWidth: 240,
          marginBottom: 24,
        }}
      >
        {interfaceName ? (
          <>
            FluxNet is monitoring{" "}
            <strong style={{ color: "var(--text)", fontWeight: 600 }}>
              {interfaceName}
            </strong>
            .
          </>
        ) : (
          <>
            FluxNet is ready.{" "}
            <strong style={{ color: "var(--text)", fontWeight: 600 }}>
              Select a network interface in Settings
            </strong>{" "}
            once one is available.
          </>
        )}
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {dots.map((label, i) => (
          <div
            key={label}
            className="ob-dot"
            style={{
              animationDelay: `${i * 80}ms`,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "var(--text-muted)",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--success)",
              }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default OnboardingPage;
