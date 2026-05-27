import { useState } from "react";
import { Loader2, Moon, Radio, Sun } from "lucide-react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ShortDipoleCalculator } from "@/components/short-dipole-calculator";
import { LoopAntennaCalculator } from "@/components/loop-antenna-calculator";
import { YagiUdaCalculator } from "@/components/yagi-uda-calculator";
import { CreditsPage } from "@/components/credits-page";
import { CalculatorSkeleton } from "@/components/loading-screen";
import { PyodideProvider, usePyodideContext } from "@/lib/pyodide-context";
import { useTheme } from "@/lib/use-theme";

type Page = "home" | "credits";

export default function App() {
  return (
    <PyodideProvider>
      <AppShell />
    </PyodideProvider>
  );
}

function AppShell() {
  const { error, readyModules } = usePyodideContext();
  const { theme, toggle } = useTheme();
  const [page, setPage] = useState<Page>("home");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Radio className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Antenna Calculator
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Toggle theme"
              className="h-8 w-8"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container flex-1 py-6">
        {page === "credits" ? (
          <CreditsPage />
        ) : (
          <Tabs defaultValue="short-dipole">
            <TabsList>
              <TabsTrigger value="short-dipole" className="gap-1.5">
                Short Dipole
                {!readyModules.has("short_dipole") && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
              </TabsTrigger>
              <TabsTrigger value="loop" className="gap-1.5">
                Loop Antenna
                {!readyModules.has("loop_antenna") && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
              </TabsTrigger>
              <TabsTrigger value="yagi" className="gap-1.5">
                Yagi-Uda
                {!readyModules.has("yagi_uda") && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="short-dipole">
              {readyModules.has("short_dipole") ? <ShortDipoleCalculator /> : <CalculatorSkeleton />}
            </TabsContent>
            <TabsContent value="loop">
              {readyModules.has("loop_antenna") ? <LoopAntennaCalculator /> : <CalculatorSkeleton />}
            </TabsContent>
            <TabsContent value="yagi">
              {readyModules.has("yagi_uda") ? <YagiUdaCalculator /> : <CalculatorSkeleton />}
            </TabsContent>
          </Tabs>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </main>

      <footer className="border-t bg-card">
        {/* Main footer body */}
        <div className="container grid grid-cols-1 gap-10 py-10 sm:grid-cols-3">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">
                Antenna Calculator
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Browser-based antenna design tool for short dipole and loop
              antennas. Compute electrical parameters instantly.
            </p>
          </div>

          {/* Calculators */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
              Calculators
            </p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setPage("home")}
              >
                Short Dipole Antenna
              </li>
              <li
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setPage("home")}
              >
                Loop Antenna
              </li>
              <li
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setPage("home")}
              >
                Yagi-Uda Antenna
              </li>
              <li
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setPage("credits")}
              >
                Credits
              </li>
            </ul>
          </div>

          {/* Course */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
              Course Info
            </p>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>ECE 325 — Transmission Media &amp; Antenna Systems</li>
              <li>ECE 3A · BS ECE</li>
              <li>A.Y. 2025–2026</li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t">
          <div className="container flex flex-col gap-1 py-3 text-xs text-muted-foreground sm:flex-row sm:h-11 sm:py-0 sm:items-center sm:justify-between">
            <span>© 2026 Ernest Villacorta. All rights reserved.</span>
            <span>Built with love and code.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
