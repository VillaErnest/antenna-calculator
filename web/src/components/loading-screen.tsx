import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

export function CalculatorSkeleton() {
  return (
    <div className="space-y-6 pt-4">
      <div className="rounded-lg border bg-card p-6 space-y-5">
        <Bone className="h-5 w-40" />
        <Bone className="h-3 w-64 opacity-50" />
        <div className="grid grid-cols-2 gap-4 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Bone className="h-3 w-24" />
              <Bone className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
        <Bone className="h-9 w-28 rounded-md" />
      </div>
    </div>
  );
}


