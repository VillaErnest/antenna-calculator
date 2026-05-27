import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { PyodideReadiness } from "@/lib/use-pyodide";
import { cn } from "@/lib/utils";

const labels: Record<PyodideReadiness, string> = {
  "loading-pyodide": "Initializing",
  "loading-packages": "Loading",
  "loading-modules": "Loading",
  ready: "Ready",
  error: "Error",
};

export function RuntimeStatus({
  status,
  detail,
  error,
}: {
  status: PyodideReadiness;
  detail?: string;
  error: string | null;
}) {
  const isError = status === "error" || !!error;
  const isReady = status === "ready" && !error;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium",
        isError
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : isReady
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "border-border bg-muted text-muted-foreground",
      )}
    >
      {isError ? (
        <AlertCircle className="h-3.5 w-3.5" />
      ) : isReady ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      )}
      <span>{error ?? labels[status]}</span>
      {detail && !isError && !isReady && (
        <span className="font-mono text-[10px] opacity-70">({detail})</span>
      )}
    </div>
  );
}
