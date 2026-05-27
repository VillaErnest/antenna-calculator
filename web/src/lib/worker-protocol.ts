// Wire protocol between the UI thread and the Pyodide worker.

export type CalculatorModule = "short_dipole" | "loop_antenna" | "yagi_uda" | "monopole";

export type WorkerRequest =
  | { type: "init"; id: string }
  | {
      type: "compute";
      id: string;
      module: CalculatorModule;
      payload: Record<string, unknown>;
    };

export type PyodideStatus = {
  type: "status";
  stage:
    | "loading-pyodide"
    | "loading-packages"
    | "loading-modules"
    | "ready"
    | "error";
  detail?: string;
};

export type WorkerResult =
  | { type: "result"; id: string; ok: true; value: unknown }
  | { type: "result"; id: string; ok: false; error: string };

export type ModuleReady = { type: "module-ready"; module: CalculatorModule };

export type WorkerResponse = PyodideStatus | WorkerResult | ModuleReady;
