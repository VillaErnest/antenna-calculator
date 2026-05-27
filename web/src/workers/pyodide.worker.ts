// Pyodide worker. Loads Pyodide + numpy/scipy from the official CDN,
// imports the two calculator modules (served from /python/), and exposes
// a tiny request/response protocol over postMessage.
//
// The worker is the only place that talks to Pyodide. The UI thread sees
// only JSON-serialisable results.

/// <reference lib="webworker" />

import type {
  CalculatorModule,
  WorkerRequest,
  WorkerResponse,
  PyodideStatus,
} from "../lib/worker-protocol";

declare const self: DedicatedWorkerGlobalScope;

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

type PyodideInterface = {
  loadPackage: (names: string | string[]) => Promise<void>;
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: {
    get(name: string): unknown;
  };
  FS: unknown;
};

let pyodide: PyodideInterface | null = null;
let initPromise: Promise<PyodideInterface> | null = null;

function post(message: WorkerResponse) {
  self.postMessage(message);
}

function status(stage: PyodideStatus["stage"], detail?: string) {
  post({ type: "status", stage, detail });
}

async function init(): Promise<PyodideInterface> {
  if (pyodide) return pyodide;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    status("loading-pyodide");
    const mod = await import(
      /* @vite-ignore */ `${PYODIDE_BASE}pyodide.mjs`
    );
    const py = (await mod.loadPyodide({
      indexURL: PYODIDE_BASE,
    })) as PyodideInterface;

    status("loading-packages", "numpy, scipy");
    await py.loadPackage(["numpy", "scipy"]);

    status("loading-modules", "calculators");
    // Fetch all source files into the Pyodide virtual filesystem.
    const modules: CalculatorModule[] = ["short_dipole", "loop_antenna", "yagi_uda"];
    for (const name of modules) {
      const res = await fetch(`${self.location.origin}/python/${name}.py`);
      if (!res.ok) throw new Error(`Failed to fetch /python/${name}.py`);
      const source = await res.text();
      await py.runPythonAsync(`
import pathlib
pathlib.Path("/home/pyodide/${name}.py").write_text(${JSON.stringify(source)})
`);
    }
    // Add the directory to sys.path once.
    await py.runPythonAsync(`
import sys
if "/home/pyodide" not in sys.path:
    sys.path.insert(0, "/home/pyodide")
`);
    // Import each module individually and signal readiness as each one loads.
    for (const name of modules) {
      await py.runPythonAsync(`import ${name}`);
      post({ type: "module-ready", module: name });
    }

    pyodide = py;
    status("ready");
    return py;
  })();

  return initPromise;
}

async function runCalculator(
  module: "short_dipole" | "loop_antenna",
  payload: Record<string, unknown>,
): Promise<unknown> {
  const py = await init();
  // Stash the payload as a Python dict via globals.
  (py.globals as unknown as { set: (k: string, v: unknown) => void }).set(
    "__payload__",
    payload,
  );
  const code = `
import json
import ${module} as _mod
_result = _mod.compute(**dict(__payload__))
json.dumps(_result)
`;
  const json = (await py.runPythonAsync(code)) as string;
  return JSON.parse(json);
}

self.addEventListener("message", async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  try {
    switch (req.type) {
      case "init":
        await init();
        post({ type: "result", id: req.id, ok: true, value: null });
        break;

      case "compute": {
        const value = await runCalculator(req.module, req.payload);
        post({ type: "result", id: req.id, ok: true, value });
        break;
      }

      default:
        post({
          type: "result",
          id: (req as { id: string }).id,
          ok: false,
          error: `Unknown request type`,
        });
    }
  } catch (err) {
    post({
      type: "result",
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// Eagerly kick off init so the first calculation is faster.
init().catch((err) => {
  post({
    type: "result",
    id: "__init__",
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  });
});
