import { createContext, useContext, type ReactNode } from "react";
import { usePyodide } from "./use-pyodide";

type Ctx = ReturnType<typeof usePyodide>;

const PyodideCtx = createContext<Ctx | null>(null);

export function PyodideProvider({ children }: { children: ReactNode }) {
  const value = usePyodide();
  return <PyodideCtx.Provider value={value}>{children}</PyodideCtx.Provider>;
}

export function usePyodideContext(): Ctx {
  const ctx = useContext(PyodideCtx);
  if (!ctx) throw new Error("usePyodideContext must be used inside PyodideProvider");
  return ctx;
}
