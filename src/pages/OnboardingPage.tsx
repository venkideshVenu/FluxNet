import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cacheHudDesign, invokeWithTimeout, setStorageItem } from "@/utils";
import { ThemeToggle, WIDGET_VIEWS, WidgetPreview } from "@/components";
import type { HudDesign } from "@/components/HudPresentation";

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
const ANIM_MS = 200;

const GLOBAL_CSS = `
  .ob-step {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    transition: opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease;
  }
  .ob-step-active { opacity: 1; transform: translateX(0); pointer-events: auto; }
  .ob-step-exit-left { opacity: 0; transform: translateX(-20px); pointer-events: none; }
  .ob-step-exit-right { opacity: 0; transform: translateX(20px); pointer-events: none; }
  .ob-step-enter-right { opacity: 0; transform: translateX(20px); pointer-events: none; }
  .ob-step-enter-left { opacity: 0; transform: translateX(-20px); pointer-events: none; }

  @keyframes ob-dot-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ob-dot { animation: ob-dot-in 0.35s ease-out both; }

  @keyframes ob-check-draw {
    from { stroke-dashoffset: 24; }
    to   { stroke-dashoffset: 0; }
  }
  .ob-check { stroke-dasharray: 24; animation: ob-check-draw 0.3s ease-out 0.1s both; }

  @keyframes ob-pop {
    0%   { transform: scale(0.5); opacity: 0; }
    70%  { transform: scale(1.12); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  .ob-pop { animation: ob-pop 0.45s ease-out both; }
  .ob-progress { transition: width 0.35s ease-out; }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce) {
    .ob-step { transition: none !important; }
    .ob-dot, .ob-check, .ob-pop { animation: none !important; }
    .ob-progress { transition: none !important; }
  }
`;

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
            transition: "width 0.3s, background 0.3s, opacity 0.3s",
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

function PersistentFooter({
  onBack,
  onNext,
  onSkip,
  nextLabel = "Next",
  nextDisabled = false,
  loading = false,
  showBack = true,
  stepIndex,
}: {
  onBack?: () => void;
  onNext: () => void;
  onSkip?: () => void;
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
              opacity: loading ? 0.4 : 1,
            }}
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
      {onSkip && (
        <div
          style={{ display: "flex", justifyContent: "center", marginTop: 10 }}
        >
          <button
            type="button"
            onClick={onSkip}
            style={{
              background: "none",
              border: "none",
              padding: "2px 8px",
              fontSize: 11,
              color: "var(--text-subtle)",
              cursor: "pointer",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Skip for now{" "}
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [direction, setDirection] = useState<Direction>("forward");
  const [interfaces, setInterfaces] = useState<InterfaceInfo[]>([]);
  const [loadingIfaces, setLoadingIfaces] = useState(true);
  const [selectedIface, setSelectedIface] = useState("");
  const [useAutoInterface, setUseAutoInterface] = useState(true);
  const [detectedIface, setDetectedIface] = useState<InterfaceInfo | null>(
    null,
  );
  const [selectedWidgets, setSelectedWidgets] = useState<Set<WidgetStyle>>(
    new Set(["pill"]),
  );
  const [hudDesign, setHudDesign] = useState<HudDesign>("horizontal");
  const [startWithWindows, setStartWithWindows] = useState(true);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [ifaceError, setIfaceError] = useState<string | null>(null);
  const interfacesFetched = useRef(false);
  const [visibleStep, setVisibleStep] = useState<Step>(step);
  const [animState, setAnimState] = useState<"active" | "transitioning">(
    "active",
  );
  const transitionTimer = useRef<NodeJS.Timeout | null>(null);

  const stepIndex = STEPS.indexOf(step);
  const progress = stepIndex / (STEPS.length - 1);

  const loadInterfaces = useCallback(async (retryCount = 3) => {
    setLoadingIfaces(true);
    setIfaceError(null);
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        if (attempt === 0 && !interfacesFetched.current) {
          await new Promise((r) => setTimeout(r, 500));
        }
        const result = await invokeWithTimeout<InterfaceInfo[]>(
          "get_interfaces",
          undefined,
          10_000,
        );
        setInterfaces(result);
        const recommended =
          result.find(
            (i) =>
              i.status === "Up" &&
              ["wifi", "ethernet"].includes(i.interface_type.toLowerCase()),
          ) || result.find((i) => i.status === "Up");
        if (recommended) {
          setSelectedIface(recommended.name);
          setDetectedIface(recommended);
        } else {
          setDetectedIface(null);
          // If there are interfaces but none are Up, pre-select first one for manual
          if (result.length > 0) {
            setSelectedIface(result[0].name);
          }
        }
        interfacesFetched.current = true;
        setLoadingIfaces(false);
        return;
      } catch (err) {
        console.error(`Interface fetch attempt ${attempt + 1} failed:`, err);
        if (attempt < retryCount - 1)
          await new Promise((r) => setTimeout(r, 1000));
      }
    }
    setIfaceError("Could not detect interfaces. Please try again.");
    setLoadingIfaces(false);
  }, []);

  useEffect(() => {
    loadInterfaces();
  }, [loadInterfaces]);

  useEffect(() => {
    if (step !== visibleStep) {
      setAnimState("transitioning");
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      transitionTimer.current = setTimeout(() => {
        setVisibleStep(step);
        setAnimState("active");
      }, ANIM_MS);
    }
    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, [step, visibleStep]);

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
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const finish = useCallback(async () => {
    setFinishing(true);
    try {
      const ifaceName = useAutoInterface
        ? detectedIface?.name || selectedIface
        : selectedIface;
      if (ifaceName)
        await invokeWithTimeout("set_interface", { name: ifaceName });
      await invoke(
        startWithWindows
          ? "plugin:autostart|enable"
          : "plugin:autostart|disable",
      ).catch(() => {});
      await invokeWithTimeout("set_minimize_to_tray", {
        enabled: minimizeToTray,
      });
      // Save the HUD design before showing widgets so a newly created HUD
      // window starts at the chosen layout's size.
      await invokeWithTimeout("set_hud_design", { design: hudDesign })
        .then(() => cacheHudDesign(hudDesign))
        .catch(() => {});
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
      await invokeWithTimeout("set_onboarding_completed").catch(() => {});
      setStorageItem("fluxnet_configured", "true");
    } finally {
      setFinishing(false);
      setDirection("forward");
      setStep("done");
    }
  }, [
    selectedIface,
    detectedIface,
    useAutoInterface,
    selectedWidgets,
    hudDesign,
    startWithWindows,
    minimizeToTray,
  ]);

  const renderStep = (s: Step): React.ReactNode => {
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
            detectedIface={detectedIface}
            useAuto={useAutoInterface}
            onToggleAuto={setUseAutoInterface}
            error={ifaceError}
            onRetry={() => loadInterfaces(3)}
          />
        );
      case "widget":
        return (
          <WidgetContent
            selected={selectedWidgets}
            onToggle={toggleWidget}
            hudDesign={hudDesign}
            onHudDesignChange={setHudDesign}
          />
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
            interfaceName={
              useAutoInterface
                ? detectedIface?.name || selectedIface
                : selectedIface
            }
            minimizeToTray={minimizeToTray}
            selectedWidgets={selectedWidgets}
          />
        );
    }
  };

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
      case "interface":
        return {
          showBack: true,
          nextLabel: "Next",
          nextDisabled: loadingIfaces,
          loading: false,
          onBack: () => nav("back"),
          onNext: () => nav("forward"),
        };
      case "widget":
        return {
          showBack: true,
          nextLabel: "Next",
          nextDisabled: false,
          loading: false,
          onBack: () => nav("back"),
          onNext: () => nav("forward"),
          onSkip: () => {
            setSelectedWidgets(new Set());
            nav("forward");
          },
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
  const exitClass =
    direction === "forward" ? "ob-step-exit-left" : "ob-step-exit-right";

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <ThemeToggle />
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
            transition: "width 0.3s ease-out",
          }}
        >
          <div
            style={{ position: "relative", height: 420, overflow: "hidden" }}
          >
            <div
              className={`ob-step ${animState === "transitioning" ? exitClass : "ob-step-active"}`}
            >
              {renderStep(visibleStep)}
            </div>
          </div>
          <PersistentFooter {...footerConfig} stepIndex={stepIndex} />
        </div>
      </div>
    </>
  );
}

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

function InterfaceContent({
  interfaces,
  loading,
  selected,
  onSelect,
  detectedIface,
  useAuto,
  onToggleAuto,
  error,
  onRetry,
}: {
  interfaces: InterfaceInfo[];
  loading: boolean;
  selected: string;
  onSelect: (n: string) => void;
  detectedIface: InterfaceInfo | null;
  useAuto: boolean;
  onToggleAuto: (v: boolean) => void;
  error?: string | null;
  onRetry: () => void;
}) {
  const up = interfaces.filter((i) => i.status === "Up");
  const down = interfaces.filter((i) => i.status !== "Up").slice(0, 4);
  const list = [...up, ...down];
  const hasActiveInterface = detectedIface !== null;

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
        Network Interface
      </h2>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
        FluxNet will monitor your network connection
      </p>

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

      {!loading && !error && hasActiveInterface && (
        <>
          {/* Auto mode card */}
          <button
            type="button"
            onClick={() => onToggleAuto(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              borderRadius: 12,
              textAlign: "left",
              border: `1px solid ${useAuto ? "var(--accent-border)" : "var(--border)"}`,
              background: useAuto
                ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                : "transparent",
              width: "100%",
              cursor: "pointer",
              marginBottom: 8,
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                flexShrink: 0,
                border: `2px solid ${useAuto ? "var(--accent)" : "var(--border-strong)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {useAuto && (
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
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: useAuto ? "var(--accent)" : "var(--text)",
                }}
              >
                Automatic (Recommended)
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                {detectedIface!.name} · {detectedIface!.interface_type} ·
                Connected
              </div>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--success-bg)",
                color: "var(--success)",
                border:
                  "1px solid color-mix(in srgb, var(--success) 25%, transparent)",
              }}
            >
              Detected
            </span>
          </button>

          {/* Manual mode */}
          <button
            type="button"
            onClick={() => onToggleAuto(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderRadius: 12,
              textAlign: "left",
              border: `1px solid ${!useAuto ? "var(--accent-border)" : "var(--border)"}`,
              background: !useAuto
                ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                : "transparent",
              width: "100%",
              cursor: "pointer",
              marginBottom: 12,
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                flexShrink: 0,
                border: `2px solid ${!useAuto ? "var(--accent)" : "var(--border-strong)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {!useAuto && (
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
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: !useAuto ? "var(--accent)" : "var(--text)",
                }}
              >
                Manual
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Choose a specific adapter
              </div>
            </div>
          </button>

          {/* Manual interface list */}
          {!useAuto && (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {list.map((iface) => {
                const isSel = iface.name === selected;
                const isUp = iface.status === "Up";
                return (
                  <button
                    key={iface.if_index}
                    type="button"
                    onClick={() => isUp && onSelect(iface.name)}
                    disabled={!isUp}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      textAlign: "left",
                      border: `1px solid ${isSel ? "var(--accent-border)" : "var(--border)"}`,
                      background: isSel
                        ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                        : "transparent",
                      opacity: !isUp ? 0.4 : 1,
                      cursor: isUp ? "pointer" : "not-allowed",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        flexShrink: 0,
                        border: `2px solid ${isSel ? "var(--accent)" : "var(--border-strong)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSel && (
                        <div
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: "var(--accent)",
                          }}
                        />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: isSel ? "var(--accent)" : "var(--text)",
                        }}
                      >
                        {iface.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
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
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* No active interfaces - show all available interfaces for manual selection */}
      {!loading && !error && !hasActiveInterface && interfaces.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
              padding: "10px 14px",
              borderRadius: 10,
              background: "var(--warning-bg)",
              border:
                "1px solid color-mix(in srgb, var(--warning) 25%, transparent)",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text)" }}>
              No active connections detected. You can select an interface
              manually or configure it later.
            </span>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {interfaces.map((iface) => {
              const isSel = iface.name === selected;
              return (
                <button
                  key={iface.if_index}
                  type="button"
                  onClick={() => onSelect(iface.name)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    textAlign: "left",
                    border: `1px solid ${isSel ? "var(--accent-border)" : "var(--border)"}`,
                    background: isSel
                      ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                      : "transparent",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      flexShrink: 0,
                      border: `2px solid ${isSel ? "var(--accent)" : "var(--border-strong)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isSel && (
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "var(--accent)",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isSel ? "var(--accent)" : "var(--text)",
                      }}
                    >
                      {iface.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-subtle)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {iface.description || iface.interface_type} ·{" "}
                      {iface.status}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {!loading && !error && interfaces.length === 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "32px 16px",
            borderRadius: 12,
            border: "1px dashed var(--border-strong)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            No interfaces found
          </div>
          <div
            style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 240 }}
          >
            You can configure it later in Settings.
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
    </div>
  );
}

const WIDGET_OPTS: { id: WidgetStyle; label: string; desc: string }[] = [
  { id: "pill", label: "Pill", desc: "Minimal inline bar" },
  { id: "compact", label: "Compact", desc: "Full stats & daily totals" },
  { id: "hud", label: "HUD", desc: "Gaming overlay" },
];

function WidgetContent({
  selected,
  onToggle,
  hudDesign,
  onHudDesignChange,
}: {
  selected: Set<WidgetStyle>;
  onToggle: (id: WidgetStyle) => void;
  hudDesign: HudDesign;
  onHudDesignChange: (d: HudDesign) => void;
}) {
  const hint =
    selected.size === 0
      ? "No widgets selected — you can enable them anytime in Settings"
      : selected.size === 1
        ? "1 widget selected"
        : `${selected.size} widgets selected`;

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
        Optional — pick styles to float on your desktop.
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
          const isHud = opt.id === "hud";
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
              }}
            >
              {/* Always render preview in dark mode regardless of page theme */}
              <div
                data-theme="dark"
                style={{
                  height: 200,
                  background: "#0d0f14",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  isolation: "isolate",
                  gap: 10,
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
                    hudDesign={isHud ? hudDesign : undefined}
                  />
                </div>
                {/* HUD design toggle — shown only when HUD card is selected */}
                {isHud && checked && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      bottom: 10,
                      display: "flex",
                      borderRadius: 8,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0,0,0,0.45)",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    {(["horizontal", "vertical"] as HudDesign[]).map((d) => {
                      const active = hudDesign === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => onHudDesignChange(d)}
                          style={{
                            padding: "4px 10px",
                            fontSize: 10,
                            fontWeight: 600,
                            border: "none",
                            cursor: "pointer",
                            letterSpacing: "0.02em",
                            background: active
                              ? "var(--accent)"
                              : "transparent",
                            color: active ? "#fff" : "rgba(255,255,255,0.5)",
                            transition: "background 0.15s, color 0.15s",
                          }}
                        >
                          {d === "horizontal" ? "Horizontal" : "Vertical"}
                        </button>
                      );
                    })}
                  </div>
                )}
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
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: checked ? "var(--accent-strong)" : "var(--text)",
                    }}
                  >
                    {opt.label}
                    {isHud && checked && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 9,
                          fontWeight: 500,
                          color: "var(--accent)",
                          background: "var(--accent-soft)",
                          border: "1px solid var(--accent-border)",
                          borderRadius: 4,
                          padding: "1px 5px",
                          textTransform: "capitalize",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {hudDesign}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
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
      }}
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
        </svg>
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
