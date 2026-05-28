import { useEffect, useState } from "react";
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
import { MonopoleCalculator, MonopoleLegacyCalculator } from "@/components/monopole-calculator";
import { CreditsPage } from "@/components/credits-page";
import { CalculatorSkeleton } from "@/components/loading-screen";
import { Toaster, toast } from "@/components/ui/toast";
import { PyodideProvider, usePyodideContext } from "@/lib/pyodide-context";
import { useTheme } from "@/lib/use-theme";

type Page = "home" | "credits" | "legacy";

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
  const [page, setPage] = useState<Page>(() =>
    window.location.pathname.includes("legacy/monopole") ? "legacy" : "home"
  );
  const [activeTab, setActiveTab] = useState("short-dipole");

  useEffect(() => {
    if (error) toast.error(error, 0);
  }, [error]);

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
          <CreditsPage onOpen={(tab) => { setActiveTab(tab); setPage("home"); }} />
        ) : page === "legacy" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => { window.history.pushState({}, "", "/"); setPage("home"); setActiveTab("monopole"); }}>
                ← Back
              </Button>
              <h2 className="text-lg font-semibold">Monopole — General Calculator</h2>
            </div>
            {readyModules.has("monopole") ? <MonopoleLegacyCalculator /> : <CalculatorSkeleton />}
          </div>
        ) : (
          <Tabs defaultValue="short-dipole" value={activeTab} onValueChange={setActiveTab}>
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
              <TabsTrigger value="monopole" className="gap-1.5">
                Monopole
                {!readyModules.has("monopole") && (
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
            <TabsContent value="monopole">
              {readyModules.has("monopole") ? <MonopoleCalculator /> : <CalculatorSkeleton />}
            </TabsContent>
          </Tabs>
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
              Browser-based antenna design tool for short dipole, loop,
              Yagi-Uda, and monopole antennas. Compute electrical parameters
              instantly.
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
                onClick={() => { setPage("home"); setActiveTab("short-dipole"); }}
              >
                Short Dipole Antenna
              </li>
              <li
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => { setPage("home"); setActiveTab("loop"); }}
              >
                Loop Antenna
              </li>
              <li
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => { setPage("home"); setActiveTab("yagi"); }}
              >
                Yagi-Uda Antenna
              </li>
              <li
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => { setPage("home"); setActiveTab("monopole"); }}
              >
                Monopole Antenna
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
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">ECE 325</p>
              <p>Transmission Media &amp; Antenna Systems</p>
              <p className="pt-1">ECE 3A &nbsp;|&nbsp; BS ECE &nbsp;|&nbsp; A.Y. 2025&ndash;2026</p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t">
          <div className="container flex flex-col gap-1 py-3 text-xs text-muted-foreground sm:flex-row sm:h-11 sm:py-0 sm:items-center sm:justify-between">
            <span>© 2026 Villacorta, Ernest Louis. All rights reserved.</span>
            <span>Built with love and code.</span>
          </div>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}
