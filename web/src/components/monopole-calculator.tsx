import { useEffect, useMemo, useState } from "react";
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
      radialaxis: {
        visible: true,
        range: [-40, 0],
        tickvals: [-40, -30, -20, -10, 0],
        tickfont: { size: 9, color: text },
        gridcolor: grid,
        linecolor: grid,
      },
      angularaxis: {
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
  const { compute, readyModules } = usePyodideContext();
  const isReady = readyModules.has("monopole");
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState<MonopoleResult | null>(null);
  const [running, setRunning] = useState(false);
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
        name: "E-Plane",
      } as Plotly.Data,
      {
        type: "scatterpolar",
        r: result.pattern_h_db,
        theta: result.pattern_theta_deg,
        mode: "lines",
        line: { color: "#f97316", width: 2 },
        fill: "toself",
        fillcolor: "rgba(249,115,22,0.12)",
        name: "H-Plane",
      } as Plotly.Data,
    ];
  }, [result]);

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
            <ScalarField
              label="Loss Resistance R_L (Ω)"
              value={form.loss_resistance}
              onChange={(v) => update("loss_resistance", v)}
            />
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
