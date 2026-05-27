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

type YagiResult = {
  zin_real: number;
  zin_imag: number;
  directivity_linear: number;
  directivity_db: number;
  efficiency_pct: number;
  gain_db: number;
  pattern_theta_deg: number[];
  pattern_e_plane_db: number[];
  pattern_h_plane_db: number[];
};

const defaultForm = {
  freq_mhz:     "432",
  len_driven:   "0.33",
  len_reflector:"0.34",
  len_directors:"0.31, 0.30, 0.29",
  spacings:     "0.15, 0.12, 0.12, 0.12",
  radius_mm:    "2",
  material:     "copper",
};

function Field({
  label,
  hint,
  value,
  onChange,
  required,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const PLOT_LAYOUT: Partial<Plotly.Layout> = {
  polar: {
    radialaxis: {
      visible: true,
      range: [-40, 0],
      tickvals: [-40, -30, -20, -10, 0],
      tickfont: { size: 9 },
    },
    angularaxis: { tickfont: { size: 9 } },
    bgcolor: "transparent",
  },
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  margin: { t: 36, r: 16, b: 16, l: 16 },
  showlegend: false,
  font: { size: 10 },
};

export function YagiUdaCalculator() {
  const { compute, readyModules } = usePyodideContext();
  const isReady = readyModules.has("yagi_uda");
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState<YagiResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  function parseList(s: string): number[] {
    return s.split(",").map((x) => Number(x.trim())).filter((n) => !isNaN(n));
  }

  async function onCalculate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRunning(true);
    try {
      const r = await compute<YagiResult>("yagi_uda", {
        freq_mhz:     Number(form.freq_mhz),
        len_driven:   Number(form.len_driven),
        len_reflector:Number(form.len_reflector),
        len_directors:parseList(form.len_directors),
        spacings:     parseList(form.spacings),
        radius_mm:    Number(form.radius_mm),
        material:     form.material,
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const rows: ResultRow[] = useMemo(() => {
    if (!result) return [];
    const sign = result.zin_imag >= 0 ? "+" : "";
    return [
      {
        label: "Input Impedance",
        value: `${formatNumber(result.zin_real)} ${sign}${formatNumber(result.zin_imag)}j`,
        unit: "Ω",
      },
      {
        label: "Directivity",
        value: formatNumber(result.directivity_linear),
        unit: "lin",
      },
      {
        label: "Directivity",
        value: formatNumber(result.directivity_db),
        unit: "dBi",
      },
      {
        label: "Gain",
        value: formatNumber(result.gain_db),
        unit: "dBi",
      },
      {
        label: "Efficiency",
        value: result.efficiency_pct.toFixed(2),
        unit: "%",
      },
    ];
  }, [result]);

  const traces = useMemo(() => {
    if (!result) return { e: null, h: null };
    const theta = result.pattern_theta_deg;
    const eTrace: Partial<Plotly.ScatterPolarData> = {
      type: "scatterpolar",
      r: result.pattern_e_plane_db,
      theta,
      mode: "lines",
      line: { color: "#3b82f6", width: 2 },
      fill: "toself",
      fillcolor: "rgba(59,130,246,0.12)",
      name: "E-Plane",
    };
    const hTrace: Partial<Plotly.ScatterPolarData> = {
      type: "scatterpolar",
      r: result.pattern_h_plane_db,
      theta,
      mode: "lines",
      line: { color: "#f97316", width: 2 },
      fill: "toself",
      fillcolor: "rgba(249,115,22,0.12)",
      name: "H-Plane",
    };
    return { e: eTrace, h: hTrace };
  }, [result]);

  function onExportPdf() {
    if (!result) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text("Yagi-Uda Antenna Calculator", 14, 18);
    autoTable(doc, {
      startY: 26,
      head: [["Parameter", "Value", "Unit"]],
      body: rows.map((r) => [r.label, r.value, r.unit ?? ""]),
      headStyles: { fillColor: [30, 58, 138] },
      styles: { font: "helvetica", fontSize: 10 },
    });
    doc.save(`yagi_uda_${Date.now()}.pdf`);
  }

  const nDirs = parseList(form.len_directors).length;
  const expectedSpaces = nDirs + 1;

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
              label="Driven element length (m)"
              value={form.len_driven}
              onChange={(v) => update("len_driven", v)}
              required
            />
            <Field
              label="Reflector length (m)"
              value={form.len_reflector}
              onChange={(v) => update("len_reflector", v)}
              required
            />
            <Field
              label="Director lengths (m, comma-separated)"
              hint="Leave empty for no directors"
              value={form.len_directors}
              onChange={(v) => update("len_directors", v)}
            />
            <Field
              label="Spacings (m, comma-separated)"
              hint={`${expectedSpaces} value${expectedSpaces !== 1 ? "s" : ""} required for ${nDirs} director${nDirs !== 1 ? "s" : ""}`}
              value={form.spacings}
              onChange={(v) => update("spacings", v)}
              required
            />
            <Field
              label="Wire radius (mm)"
              value={form.radius_mm}
              onChange={(v) => update("radius_mm", v)}
              required
            />

            <div className="space-y-1">
              <Label>Material</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.material}
                onChange={(e) => update("material", e.target.value)}
              >
                <option value="copper">Copper (5.96×10⁷ S/m)</option>
                <option value="aluminum">Aluminum (3.50×10⁷ S/m)</option>
                <option value="silver">Silver (6.30×10⁷ S/m)</option>
              </select>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!isReady || running}
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculating…
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Calculate
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Results</CardTitle>
                <Button variant="outline" size="sm" onClick={onExportPdf}>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Export PDF
                </Button>
              </CardHeader>
              <CardContent>
                <ResultsTable rows={rows} />
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">E-Plane Pattern (dB)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {traces.e && (
                    <Plot
                      data={[traces.e as Plotly.Data]}
                      layout={{ ...PLOT_LAYOUT, title: undefined } as Plotly.Layout}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: "100%", height: 300 }}
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">H-Plane Pattern (dB)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {traces.h && (
                    <Plot
                      data={[traces.h as Plotly.Data]}
                      layout={{ ...PLOT_LAYOUT, title: undefined } as Plotly.Layout}
                      config={{ responsive: true, displayModeBar: false }}
                      style={{ width: "100%", height: 300 }}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {!result && !error && (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              Fill in the parameters and click Calculate
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
