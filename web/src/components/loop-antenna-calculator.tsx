import { useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { Loader2, Calculator, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResultsTable, type ResultRow } from "@/components/results-table";
import { usePyodideContext } from "@/lib/pyodide-context";
import { formatNumber } from "@/lib/utils";

type LoopResult = {
  frequency_mhz: number;
  radius: number;
  turns: number;
  mu_reff: number;
  radiation_resistance: number;
  directivity_linear: number;
  directivity_db: number;
  theta_rad: number[];
  pattern_db: number[];
  loss_resistance?: number;
  efficiency?: number;
  gain_linear?: number;
  gain_db?: number;
};

const defaultForm = {
  freq_mhz: "100",
  radius: "0.1",
  turns: "1",
  mu_reff: "1",
  loss_resistance: "1",
};

export function LoopAntennaCalculator() {
  const { compute, readyModules } = usePyodideContext();
  const isReady = readyModules.has("loop_antenna");
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState<LoopResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onCalculate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRunning(true);
    try {
      const payload: Record<string, unknown> = {
        f_mhz: Number(form.freq_mhz),
        a: Number(form.radius),
        N: Number(form.turns) || 1,
        mu_r: Number(form.mu_reff) || 1,
      };
      if (form.loss_resistance.trim() !== "") {
        payload.loss_resistance = Number(form.loss_resistance);
      }
      const r = await compute<LoopResult>("loop_antenna", payload);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const rows: ResultRow[] = useMemo(() => {
    if (!result) return [];
    const base: ResultRow[] = [
      {
        label: "Radiation Resistance",
        value: formatNumber(result.radiation_resistance),
        unit: "Ω",
      },
      {
        label: "Directivity (D₀)",
        value: formatNumber(result.directivity_linear),
        unit: "lin",
      },
      {
        label: "Directivity (D₀)",
        value: formatNumber(result.directivity_db),
        unit: "dB",
      },
    ];
    if (result.gain_linear !== undefined) {
      base.push(
        {
          label: "Loss Resistance",
          value: formatNumber(result.loss_resistance ?? 0),
          unit: "Ω",
        },
        {
          label: "Efficiency",
          value: ((result.efficiency ?? 0) * 100).toFixed(2),
          unit: "%",
        },
        {
          label: "Gain",
          value: formatNumber(result.gain_linear),
          unit: "lin",
        },
        {
          label: "Gain",
          value: formatNumber(result.gain_db ?? 0),
          unit: "dB",
        },
      );
    }
    return base;
  }, [result]);

  // Plotly polar trace: mirror across 180° so the full pattern is shown.
  const polarTrace = useMemo(() => {
    if (!result) return null;
    const thetaDeg = result.theta_rad.map((t) => (t * 180) / Math.PI);
    const fullTheta = [...thetaDeg, ...thetaDeg.map((t) => t + 180)];
    const fullR = [...result.pattern_db, ...result.pattern_db];
    return { fullTheta, fullR };
  }, [result]);

  function onExportPdf() {
    if (!result) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text("Loop Antenna Calculator", 14, 18);
    autoTable(doc, {
      startY: 26,
      head: [["Parameter", "Value", "Unit"]],
      body: rows.map((r) => [r.label, r.value, r.unit ?? ""]),
      headStyles: { fillColor: [30, 58, 138] },
      styles: { font: "helvetica", fontSize: 10 },
    });
    doc.save(`loop_antenna_${Date.now()}.pdf`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCalculate} className="space-y-3">
            <Field
              label="Frequency (MHz)"
              value={form.freq_mhz}
              onChange={(v) => update("freq_mhz", v)}
              required
            />
            <Field
              label="Loop radius a (m)"
              value={form.radius}
              onChange={(v) => update("radius", v)}
              required
            />
            <Field
              label="Number of turns N"
              value={form.turns}
              onChange={(v) => update("turns", v)}
            />
            <Field
              label="Effective permeability μ_reff"
              value={form.mu_reff}
              onChange={(v) => update("mu_reff", v)}
            />
            <Field
              label="Loss Resistance R_L (Ω)"
              value={form.loss_resistance}
              onChange={(v) => update("loss_resistance", v)}
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

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Numerical Results</CardTitle>
            {result && (
              <Button variant="outline" size="sm" onClick={onExportPdf}>
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : result ? (
              <ResultsTable rows={rows} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Enter parameters and run a calculation to see results.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Radiation Pattern (dB)</CardTitle>
          </CardHeader>
          <CardContent>
            {polarTrace ? (
              <Plot
                data={[
                  {
                    type: "scatterpolar",
                    mode: "lines",
                    theta: polarTrace.fullTheta,
                    r: polarTrace.fullR,
                    line: { color: "#0052cc", width: 2 },
                    name: "Pattern",
                  },
                ]}
                layout={{
                  autosize: true,
                  height: 420,
                  margin: { t: 30, b: 30, l: 30, r: 30 },
                  polar: {
                    radialaxis: {
                      range: [-40, 0],
                      tickvals: [-30, -20, -10, 0],
                      tickfont: { size: 10 },
                    },
                    angularaxis: {
                      direction: "clockwise",
                      rotation: 90,
                    },
                  },
                  showlegend: false,
                  paper_bgcolor: "rgba(0,0,0,0)",
                  plot_bgcolor: "rgba(0,0,0,0)",
                }}
                config={{ displaylogo: false, responsive: true }}
                style={{ width: "100%" }}
                useResizeHandler
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Run a calculation to plot the radiation pattern.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}
