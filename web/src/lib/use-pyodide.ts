import { useEffect, useRef, useState, useCallback } from "react";
import type {
  CalculatorModule,
  PyodideStatus,
  WorkerRequest,
  WorkerResponse,
} from "./worker-protocol";

type WorkerRequestNoId =
  | { type: "init" }
  | {
      type: "compute";
      module: CalculatorModule;
      payload: Record<string, unknown>;
    };

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

export type PyodideReadiness = PyodideStatus["stage"];

export function usePyodide() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, Pending>>(new Map());
  const [status, setStatus] = useState<PyodideReadiness>("loading-pyodide");
  const [statusDetail, setStatusDetail] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [readyModules, setReadyModules] = useState<Set<CalculatorModule>>(new Set());

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/pyodide.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      if (msg.type === "status") {
        setStatus(msg.stage);
        setStatusDetail(msg.detail);
        return;
      }
      if (msg.type === "module-ready") {
        setReadyModules((prev) => {
          const next = new Set(prev);
          next.add(msg.module);
          return next;
        });
        return;
      }
      if (msg.type === "result") {
        const pending = pendingRef.current.get(msg.id);
        if (!pending) return;
        pendingRef.current.delete(msg.id);
        if (msg.ok) pending.resolve(msg.value);
        else pending.reject(new Error(msg.error));
      }
    };

    worker.onerror = (ev) => {
      setError(ev.message || "Worker crashed");
      setStatus("error");
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const send = useCallback((req: WorkerRequestNoId): Promise<unknown> => {
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error("Worker not ready"));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      worker.postMessage({ ...req, id } as WorkerRequest);
    });
  }, []);

  const compute = useCallback(
    async <T,>(module: CalculatorModule, payload: Record<string, unknown>): Promise<T> => {
      const value = await send({ type: "compute", module, payload });
      return value as T;
    },
    [send],
  );

  return { status, statusDetail, error, compute, readyModules, isReady: status === "ready" };
}
