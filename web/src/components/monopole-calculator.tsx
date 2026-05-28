import { useEffect, useMemo, useState, useCallback } from "react";
import Plot from "react-plotly.js";
import { Loader2, Download, Copy, Calculator } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResultsTable, type ResultRow } from "@/components/results-table";
import { usePyodideContext } from "@/lib/pyodide-context";
import { toast } from "@/components/ui/toast";
import { formatNumber } from "@/lib/utils";

type MonopoleResult = {
  frequency: number;
  length: number;
  lambda: number;
  radiation_resistance: number;
  efficiency: number;
  directivity: number;
  gain: number;
  effective_area: number;
  beam_solid_angle: number;
  radiated_power: number;
  radiation_intensity: number;
  e_field: number;
  h_field: number;
  f_theta: number;
  pattern_theta_deg: number[];
  pattern_e_db: number[];
  pattern_h_db: number[];
  state: "valid" | "warning" | "error";
};

// ---- Solver types ----
type SolverMeta = {
  label: string;
  inputs: string[];
  input_labels: Record<string, string>;
  unit: string;
  category: string;
  target: string;
};
type SolverCatalog = Record<string, SolverMeta>;

type SolveResult = {
  result: number;
  unit: string;
  label: string;
  solver_key: string;
  solver_meta: SolverMeta;
  input_labels: Record<string, string>;
};

const defaultForm = {
  freq_value: "100",
  freq_unit: "MHz",
  length_value: "75",
  length_unit: "cm",
  current: "1",
  loss_resistance: "0",
  distance: "1000",
  theta_deg: "90",
};

function useDarkMode(): boolean {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function buildPlotLayout(dark: boolean): Partial<Plotly.Layout> {
  const text = dark ? "#e2e8f0" : "#1e293b";
  const grid = dark ? "#334155" : "#e2e8f0";
  return {
    polar: {
      sector: [0, 180],
      radialaxis: {
        visible: true,
        range: [-40, 0],
        tickvals: [-40, -30, -20, -10, 0],
        tickfont: { size: 9, color: text },
        gridcolor: grid,
        linecolor: grid,
        angle: 90,
      },
      angularaxis: {
        tickmode: "array",
        tickvals: [0, 30, 60, 90, 120, 150, 180],
        ticktext: ["90\u00b0", "60\u00b0", "30\u00b0", "0\u00b0", "-30\u00b0", "-60\u00b0", "-90\u00b0"],
        tickfont: { size: 9, color: text },
        gridcolor: grid,
        linecolor: grid,
      },
      bgcolor: "transparent",
    },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    margin: { t: 36, r: 16, b: 16, l: 16 },
    showlegend: true,
    legend: { font: { size: 10, color: text } },
    font: { size: 10, color: text },
  };
}

export function MonopoleCalculator() {
  const { readyModules } = usePyodideContext();
  const isReady = readyModules.has("monopole");
  return <SolveParameterPanel isReady={isReady} />;
}

export function MonopoleLegacyCalculator() {
  const { compute, readyModules } = usePyodideContext();
  const isReady = readyModules.has("monopole");
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState<MonopoleResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isDark = useDarkMode();
  const plotLayout = useMemo(() => buildPlotLayout(isDark), [isDark]);

  const update = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onCalculate(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    try {
      const payload = {
        freq_value: Number(form.freq_value),
        freq_unit: form.freq_unit,
        length_value: Number(form.length_value),
        length_unit: form.length_unit,
        current: Number(form.current),
        loss_resistance: Number(form.loss_resistance),
        distance: Number(form.distance),
        theta_deg: Number(form.theta_deg),
      };
      const r = await compute<MonopoleResult>("monopole", payload);
      setResult(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const rows: ResultRow[] = result
    ? [
        { label: "Wavelength (λ)", value: formatNumber(result.lambda), unit: "m" },
        {
          label: "Radiation Resistance",
          value: formatNumber(result.radiation_resistance),
          unit: "Ω",
        },
        {
          label: "Efficiency",
          value: (result.efficiency * 100).toFixed(2),
          unit: "%",
        },
        { label: "Directivity", value: formatNumber(result.directivity) },
        { label: "Gain", value: formatNumber(result.gain) },
        {
          label: "Effective Area",
          value: formatNumber(result.effective_area),
          unit: "m²",
        },
        {
          label: "Beam Solid Angle",
          value: formatNumber(result.beam_solid_angle),
          unit: "sr",
        },
        {
          label: "Radiated Power",
          value: formatNumber(result.radiated_power),
          unit: "W",
        },
        {
          label: "Radiation Intensity",
          value: formatNumber(result.radiation_intensity),
          unit: "W/sr",
        },
        { label: "E-Field", value: formatNumber(result.e_field), unit: "V/m" },
        { label: "H-Field", value: formatNumber(result.h_field), unit: "A/m" },
        { label: "F(θ)", value: formatNumber(result.f_theta) },
      ]
    : [];

  const patternTraces = useMemo((): Plotly.Data[] => {
    if (!result) return [];
    return [
      {
        type: "scatterpolar",
        r: result.pattern_e_db,
        theta: result.pattern_theta_deg,
        mode: "lines",
        line: { color: "#3b82f6", width: 2 },
        fill: "toself",
        fillcolor: "rgba(59,130,246,0.12)",
        name: "Norm F(\u03b8)",
      } as Plotly.Data,
      {
        type: "scatterpolar",
        r: [0, -40, 0],
        theta: [0, 90, 180],
        mode: "lines",
        line: { color: isDark ? "#e2e8f0" : "#0f172a", width: 2 },
        name: "Ground",
        hoverinfo: "skip",
      } as Plotly.Data,
    ];
  }, [result, isDark]);

  async function onCopy() {
    if (!result) return;
    const text = rows.map((r) => `${r.label}: ${r.value} ${r.unit ?? ""}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API may be blocked; ignore silently.
    }
  }

  function onExportPdf() {
    if (!result) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text("Quarter-Wave Monopole Antenna Calculator", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    autoTable(doc, {
      startY: 26,
      head: [["Parameter", "Value", "Unit"]],
      body: rows.map((r) => [r.label, r.value, r.unit ?? ""]),
      headStyles: { fillColor: [30, 58, 138] },
      styles: { font: "helvetica", fontSize: 10 },
    });
    doc.save(`monopole_${Date.now()}.pdf`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCalculate} className="space-y-3">
            <PairField
              label="Frequency"
              valueProps={{
                value: form.freq_value,
                onChange: (e) => update("freq_value", e.target.value),
                type: "number",
                step: "any",
                required: true,
              }}
              unitProps={{
                value: form.freq_unit,
                onChange: (e) => update("freq_unit", e.target.value),
              }}
              units={["Hz", "kHz", "MHz", "GHz"]}
            />
            <PairField
              label="Length"
              valueProps={{
                value: form.length_value,
                onChange: (e) => update("length_value", e.target.value),
                type: "number",
                step: "any",
                required: true,
              }}
              unitProps={{
                value: form.length_unit,
                onChange: (e) => update("length_unit", e.target.value),
              }}
              units={["m", "cm", "mm"]}
            />
            <ScalarField
              label="Current (A)"
              value={form.current}
              onChange={(v) => update("current", v)}
            />
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              <span className="text-base leading-none">{showAdvanced ? "▾" : "▸"}</span>
              Advanced
            </button>
            {showAdvanced && (
              <ScalarField
                label="Loss Resistance R_L (Ω)"
                value={form.loss_resistance}
                onChange={(v) => update("loss_resistance", v)}
              />
            )}
            <ScalarField
              label="Distance d (m)"
              value={form.distance}
              onChange={(v) => update("distance", v)}
            />
            <ScalarField
              label="Theta angle (°)"
              value={form.theta_deg}
              onChange={(v) => update("theta_deg", v)}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={!isReady || running}
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Calculating...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4" /> Calculate
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Results</CardTitle>
          {result && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onCopy}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
              <Button variant="outline" size="sm" onClick={onExportPdf}>
                <Download className="h-3.5 w-3.5" /> Export PDF
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {result ? (
            <ResultsTable rows={rows} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter parameters and run a calculation to see results.
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Radiation Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <Plot
              data={patternTraces}
              layout={plotLayout}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: 320 }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JS pattern helper (mirrors calc_pattern_arrays in Python)
// ---------------------------------------------------------------------------
function jsCalcPatternArrays() {
  const plotDeg: number[] = [];
  const eDb: number[] = [];
  for (let p = 0; p <= 180; p++) {
    plotDeg.push(p);
    const antTheta = Math.abs(90 - p) * (Math.PI / 180);
    const s = Math.sin(antTheta);
    const F = Math.abs(s) < 1e-10 ? 0 : Math.abs(Math.cos((Math.PI / 2) * Math.cos(antTheta)) / s);
    eDb.push(Math.max(20 * Math.log10(Math.max(F, 1e-10)), -40));
  }
  return { plotDeg, eDb };
}

// ---------------------------------------------------------------------------
// Solve Parameter Panel
// ---------------------------------------------------------------------------

function SolveParameterPanel({ isReady }: { isReady: boolean }) {
  const { compute } = usePyodideContext();
  const isDark = useDarkMode();
  const plotLayout = useMemo(() => buildPlotLayout(isDark), [isDark]);
  const [catalog, setCatalog] = useState<SolverCatalog | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [category, setCategory] = useState("");
  const [solverKey, setSolverKey] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [isRad, setIsRad] = useState(false);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [running, setRunning] = useState(false);
  // marker: [plotAngle, F_dB] pairs for radiation pattern
  const [patternMarker, setPatternMarker] = useState<{ angles: number[]; fdbs: number[] } | null>(null);

  // Load catalog once when panel is first ready
  const loadCatalog = useCallback(async () => {
    if (catalog || loadingCatalog || !isReady) return;
    setLoadingCatalog(true);
    try {
      const data = await compute<SolverCatalog>("monopole", { _call: "get_solver_catalog" });
      setCatalog(data);
      const firstCat = Object.values(data)[0]?.category ?? "";
      setCategory(firstCat);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingCatalog(false);
    }
  }, [catalog, loadingCatalog, isReady, compute]);

  useEffect(() => {
    if (isReady) loadCatalog();
  }, [isReady, loadCatalog]);

  const categories = useMemo(() => {
    if (!catalog) return [];
    return [...new Set(Object.values(catalog).map((m) => m.category))];
  }, [catalog]);

  const solversInCategory = useMemo(() => {
    if (!catalog || !category) return {} as SolverCatalog;
    return Object.fromEntries(
      Object.entries(catalog).filter(([, m]) => m.category === category)
    ) as SolverCatalog;
  }, [catalog, category]);

  // Auto-select first solver when category changes
  useEffect(() => {
    const keys = Object.keys(solversInCategory);
    if (keys.length > 0) {
      setSolverKey(keys[0]);
      setParamValues({});
      setResult(null);
      setPatternMarker(null);
    }
  }, [solversInCategory]);

  const activeMeta = catalog && solverKey ? catalog[solverKey] : null;

  async function onSolve(e: React.FormEvent) {
    e.preventDefault();
    if (!activeMeta) return;
    setRunning(true);
    try {
      const params: Record<string, unknown> = { _call: "solve", solver_key: solverKey, params: {} };
      const inner: Record<string, number | boolean> = {};
      for (const key of activeMeta.inputs) {
        const raw = paramValues[key] ?? "";
        const n = parseFloat(raw);
        if (isNaN(n)) {
          toast.error(`Invalid value for ${key}`);
          setRunning(false);
          return;
        }
        inner[key] = n;
      }
      if (activeMeta.inputs.includes("theta")) inner["is_rad"] = isRad;
      params["params"] = inner;
      const r = await compute<SolveResult>("monopole", params);
      setResult(r);

      // Compute radiation pattern marker
      if (activeMeta.category === "Radiation Pattern") {
        let thetaRad: number;
        let fValue: number;
        if (solverKey === "F_from_theta") {
          // theta is input, F is result
          const rawTheta = parseFloat(paramValues["theta"] ?? "0");
          thetaRad = isRad ? rawTheta : rawTheta * (Math.PI / 180);
          fValue = r.result;
        } else {
          // F is input, theta (rad) is result
          thetaRad = r.result;
          fValue = parseFloat(paramValues["F"] ?? "0");
        }
        const thetaDeg = thetaRad * (180 / Math.PI);
        const fDb = Math.max(20 * Math.log10(Math.max(fValue, 1e-10)), -40);
        // The polar plot uses plot_angle where plot_angle = 90 - theta_deg (left) and 90 + theta_deg (right)
        const angleLeft = 90 - thetaDeg;
        const angleRight = 90 + thetaDeg;
        setPatternMarker({ angles: [angleLeft, angleRight], fdbs: [fDb, fDb] });
      } else {
        setPatternMarker(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  if (!isReady || loadingCatalog) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        {loadingCatalog ? "Loading solver catalog…" : "Waiting for Python engine…"}
      </div>
    );
  }

  if (!catalog) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Solve for a Parameter</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSolve} className="space-y-4">
            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={category}
                onChange={(e) => { setCategory(e.target.value); setResult(null); }}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Formula */}
            <div className="space-y-1.5">
              <Label>Formula</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={solverKey}
                onChange={(e) => { setSolverKey(e.target.value); setParamValues({}); setResult(null); }}
              >
                {Object.entries(solversInCategory).map(([k, m]) => (
                  <option key={k} value={k}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Dynamic inputs */}
            {activeMeta && activeMeta.inputs.map((inp) => (
              <div className="space-y-1.5" key={inp}>
                <Label>{activeMeta.input_labels[inp] ?? inp}</Label>
                <Input
                  type="number"
                  step="any"
                  value={paramValues[inp] ?? ""}
                  onChange={(e) => setParamValues((p) => ({ ...p, [inp]: e.target.value }))}
                  required
                />
              </div>
            ))}

            {/* Angle unit toggle for theta inputs */}
            {activeMeta?.inputs.includes("theta") && (
              <div className="flex items-center gap-4 text-sm">
                <Label>Angle unit:</Label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={!isRad} onChange={() => setIsRad(false)} /> Degrees
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={isRad} onChange={() => setIsRad(true)} /> Radians
                </label>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={running}>
              {running ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Solving…</>
              ) : (
                <><Calculator className="h-4 w-4" /> Solve</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs text-muted-foreground mb-1">Formula</p>
                <p className="font-mono text-sm">{result.label}</p>
              </div>
              <div className="rounded-lg border p-4 flex flex-col items-center justify-center gap-1">
                <p className="text-xs text-muted-foreground">
                  {result.solver_meta.target}
                </p>
                <p className="text-4xl font-bold tabular-nums">
                  {formatNumber(result.result)}
                </p>
                {result.unit && (
                  <p className="text-sm text-muted-foreground">{result.unit}</p>
                )}
              </div>
              {/* Show inputs used */}
              {Object.keys(result.input_labels).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Inputs used</p>
                  <ResultsTable
                    rows={Object.entries(result.input_labels).map(([k, lbl]) => ({
                      label: lbl,
                      value: paramValues[k] ?? "—",
                    }))}
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a category and formula, enter the known values, and click Solve.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Radiation pattern chart — spans full width when available */}
      {result?.solver_meta.category === "Radiation Pattern" && (
        <SolverPatternChart
          marker={patternMarker}
          layout={plotLayout}
          className="lg:col-span-2"
        />
      )}
    </div>
  );
}

function SolverPatternChart({
  marker,
  layout,
  className,
}: {
  marker: { angles: number[]; fdbs: number[] } | null;
  layout: Partial<Plotly.Layout>;
  className?: string;
}) {
  const { plotDeg, eDb } = useMemo(() => jsCalcPatternArrays(), []);

  const traces = useMemo((): Plotly.Data[] => {
    const base: Plotly.Data[] = [
      {
        type: "scatterpolar",
        r: eDb,
        theta: plotDeg,
        mode: "lines",
        line: { color: "#3b82f6", width: 2 },
        fill: "toself",
        fillcolor: "rgba(59,130,246,0.12)",
        name: "Norm F(θ)",
      } as Plotly.Data,
      {
        type: "scatterpolar",
        r: [0, -40, 0],
        theta: [0, 90, 180],
        mode: "lines",
        line: { color: "#0f172a", width: 2 },
        name: "Ground",
        hoverinfo: "skip",
      } as Plotly.Data,
    ];
    if (marker) {
      base.push({
        type: "scatterpolar",
        r: marker.fdbs,
        theta: marker.angles,
        mode: "markers",
        marker: { color: "#ef4444", size: 10, symbol: "circle" },
        name: "Solved point",
      } as Plotly.Data);
    }
    return base;
  }, [eDb, plotDeg, marker]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Radiation Pattern</CardTitle>
      </CardHeader>
      <CardContent>
        <Plot
          data={traces}
          layout={layout}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%", height: 320 }}
        />
      </CardContent>
    </Card>
  );
}

function ScalarField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
  );
}

function PairField({
  label,
  valueProps,
  unitProps,
  units,
}: {
  label: string;
  valueProps: React.InputHTMLAttributes<HTMLInputElement>;
  unitProps: React.SelectHTMLAttributes<HTMLSelectElement>;
  units: string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input className="flex-1" {...valueProps} />
        <Select className="w-24" {...unitProps}>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
