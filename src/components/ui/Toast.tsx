import {
  useEffect,
  useState,
  useCallback,
  createContext,
  useContext,
} from "react";

type ToastItem = {
  id: number;
  message: string;
  type?: "success" | "info" | "error";
};

type ToastContextType = {
  showToast: (message: string, type?: "success" | "info" | "error") => void;
};

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (message: string, type: "success" | "info" | "error" = "success") => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {toasts.map((toast) => (
          <ToastMessage key={toast.id} toast={toast} onDone={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastMessage({
  toast,
  onDone,
}: {
  toast: ToastItem;
  onDone: (id: number) => void;
}) {
  const [state, setState] = useState<"enter" | "visible" | "exit">("enter");

  useEffect(() => {
    const enterTimer = setTimeout(() => setState("visible"), 20);
    const exitTimer = setTimeout(() => setState("exit"), 2500);
    const removeTimer = setTimeout(() => onDone(toast.id), 2800);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, onDone]);

  const icon = toast.type === "error" ? "✕" : toast.type === "info" ? "ℹ" : "✓";

  const iconColor =
    toast.type === "error"
      ? "var(--danger)"
      : toast.type === "info"
        ? "var(--accent)"
        : "var(--success)";

  return (
    <div
      style={{
        padding: "10px 16px",
        borderRadius: 10,
        background: "var(--panel)",
        border: "1px solid var(--border)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        fontSize: 12,
        fontWeight: 500,
        color: "var(--text)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        pointerEvents: "auto",
        transition: "opacity 0.25s ease, transform 0.25s ease",
        opacity: state === "visible" ? 1 : 0,
        transform:
          state === "enter"
            ? "translateY(-12px)"
            : state === "exit"
              ? "translateY(-8px)"
              : "translateY(0)",
      }}
    >
      <span style={{ color: iconColor, fontWeight: 700, fontSize: 13 }}>
        {icon}
      </span>
      {toast.message}
    </div>
  );
}
