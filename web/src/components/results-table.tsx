import { cn } from "@/lib/utils";

export type ResultRow = {
  label: string;
  value: string;
  unit?: string;
};

export function ResultsTable({
  rows,
  className,
}: {
  rows: ResultRow[];
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-md border", className)}>
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Parameter</th>
            <th className="px-3 py-2 text-right font-medium">Value</th>
            <th className="px-3 py-2 text-left font-medium w-24">Unit</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.label} className="hover:bg-muted/40">
              <td className="px-3 py-2">{r.label}</td>
              <td className="px-3 py-2 text-right font-mono">{r.value}</td>
              <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                {r.unit ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
