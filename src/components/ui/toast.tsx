"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
};

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  toast: (t: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: typeof CheckCircle2; accent: string; iconColor: string }
> = {
  success: { icon: CheckCircle2, accent: "var(--success)", iconColor: "text-success" },
  error: { icon: XCircle, accent: "var(--danger)", iconColor: "text-danger" },
  warning: { icon: TriangleAlert, accent: "var(--warning)", iconColor: "text-warning" },
  info: { icon: Info, accent: "var(--primary)", iconColor: "text-primary" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = Math.random().toString(36).slice(2);
    const next: Toast = {
      id,
      title: input.title,
      description: input.description,
      variant: input.variant ?? "info",
      duration: input.duration ?? 4500,
    };
    setToasts((prev) => [...prev, next]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const { icon: Icon, accent, iconColor } = VARIANT_STYLES[toast.variant];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      style={{ animation: "toast-in 0.28s cubic-bezier(0.22,1,0.36,1) both" }}
      className="pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-lg"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: accent }}
      />
      <Icon className={cn("mt-0.5 size-5 shrink-0", iconColor)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-sm text-muted">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-m-1 rounded-md p-1 text-muted-2 transition-colors hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
