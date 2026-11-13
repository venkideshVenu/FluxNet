import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CircleCheck, CircleX, Info } from "lucide-react";

type ToastType = "success" | "info" | "error";
type ToastItem = { id: number; message: string; type: ToastType };
type ToastContextType = { showToast: (message: string, type?: ToastType) => void };

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

const ICONS: Record<ToastType, ReactNode> = {
  success: <CircleCheck className="size-4 text-success" />,
  info: <Info className="size-4 text-accent" />,
  error: <CircleX className="size-4 text-critical" />,
};

/** Brief confirmations ("Peak speeds reset"), shown as a Fluent flyout at the bottom. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDone={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDone }: { toast: ToastItem; onDone: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leave = setTimeout(() => setLeaving(true), 2600);
    const done = setTimeout(() => onDone(toast.id), 2850);
    return () => {
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, [toast.id, onDone]);

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex items-center gap-3 rounded-card border border-flyout-stroke bg-flyout px-4 py-2.5 text-body text-fg shadow-flyout transition-opacity duration-[250ms] animate-page-in ${leaving ? "opacity-0" : "opacity-100"}`}
    >
      {ICONS[toast.type]}
      {toast.message}
    </div>
  );
}
