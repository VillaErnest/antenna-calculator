import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
};

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(message: string, variant: ToastVariant, duration: number) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now() + Math.random());
  const toast: Toast = { id, message, variant, duration };
  toasts = [...toasts, toast];
  emit();
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

export const toast = {
  show: (message: string, duration = 4000) => push(message, "default", duration),
  success: (message: string, duration = 4000) => push(message, "success", duration),
  error: (message: string, duration = 6000) => push(message, "error", duration),
  info: (message: string, duration = 4000) => push(message, "info", duration),
  dismiss,
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: "border-border bg-card text-foreground",
  success:
    "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
  error:
    "border-destructive/40 bg-destructive/10 text-destructive dark:text-destructive-foreground",
  info: "border-primary/40 bg-primary/10 text-foreground",
};

function VariantIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "success") return <CheckCircle2 className="h-4 w-4 flex-shrink-0" />;
  if (variant === "error") return <AlertCircle className="h-4 w-4 flex-shrink-0" />;
  if (variant === "info") return <Info className="h-4 w-4 flex-shrink-0" />;
  return null;
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>(toasts);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 shadow-lg",
            "animate-in fade-in slide-in-from-right-4",
            VARIANT_STYLES[t.variant],
          )}
        >
          <VariantIcon variant={t.variant} />
          <p className="flex-1 text-sm leading-relaxed">{t.message}</p>
          <button
            onClick={() => dismiss(t.id)}
            className="rounded-sm opacity-60 transition hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
