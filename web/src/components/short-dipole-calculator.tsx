import { useState } from "react";
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
import { formatNumber } from "@/lib/utils";

type ShortDipoleResult = {
  frequency: number;
  length: number;
  lambda: number;
  radiation_resistance: number;
  efficiency: number;
  gain: number;
  effective_area: number;
  dmax: number;
  d_theta: number;
  radiated_power: number;
  radiation_intensity: number;
  effective_length: number;
  e_field: number;
  impedance_real: number;
  impedance_imag: number;
  state: "valid" | "warning" | "error";
};

const defaultForm = {
  freq_value: "100",
  freq_unit: "MHz",
  length_value: "30",
  length_unit: "cm",
  current: "1",
  loss_resistance: "0",
  distance: "1000",
  theta_deg: "90",
  reactance: "0",
};

export function ShortDipoleCalculator() {
  const { compute, readyModules } = usePyodideContext();
  const isReady = readyModules.has("short_dipole");
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState<ShortDipoleResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onCalculate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
        reactance: Number(form.reactance),
      };
      const r = await compute<ShortDipoleResult>("short_dipole", payload);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
        { label: "Gain", value: formatNumber(result.gain) },
        {
          label: "Effective Area",
          value: formatNumber(result.effective_area),
          unit: "m²",
        },
        { label: "Dmax", value: formatNumber(result.dmax) },
        { label: "D(θ)", value: formatNumber(result.d_theta) },
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
        {
          label: "Effective Length",
          value: formatNumber(result.effective_length),
          unit: "m",
        },
        { label: "E-Field", value: formatNumber(result.e_field), unit: "V/m" },
        {
          label: "Impedance",
          value: `${formatNumber(result.impedance_real)} + j${formatNumber(result.impedance_imag)}`,
          unit: "Ω",
        },
      ]
    : [];

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
    doc.text("Short Dipole Antenna Calculator", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Status: ${result.state.toUpperCase()}`,
      14,
      26,
    );
    autoTable(doc, {
      startY: 32,
      head: [["Parameter", "Value", "Unit"]],
      body: rows.map((r) => [r.label, r.value, r.unit ?? ""]),
      headStyles: { fillColor: [30, 58, 138] },
      styles: { font: "helvetica", fontSize: 10 },
    });
    doc.save(`short_dipole_${Date.now()}.pdf`);
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
            <ScalarField
              label="Reactance X_A (Ω)"
              value={form.reactance}
              onChange={(v) => update("reactance", v)}
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
              <span
                className={
                  result.state === "valid"
                    ? "text-xs font-medium text-emerald-600"
                    : result.state === "warning"
                      ? "text-xs font-medium text-amber-600"
                      : "text-xs font-medium text-destructive"
                }
              >
                {result.state.toUpperCase()}
              </span>
              <Button variant="outline" size="sm" onClick={onCopy}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
              <Button variant="outline" size="sm" onClick={onExportPdf}>
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
            </div>
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
