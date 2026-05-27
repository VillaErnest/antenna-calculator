import { Radio } from "lucide-react";

interface Contributor {
  name: string;
  role?: string;
}

interface CreditSection {
  title: string;
  description: string;
  contributors: Contributor[];
}

const SECTIONS: CreditSection[] = [
  {
    title: "Web Application",
    description:
      "Design, development, and Python integration of the browser-based tool.",
    contributors: [
      { name: "Villacorta, Ernest Louis", role: "Web app & Python integration" },
    ],
  },
  {
    title: "Monopole Antenna Calculator",
    description:
      "Computation logic and formulas for the quarter-wave monopole antenna model.",
    contributors: [
      { name: "Albiso" },
      { name: "Casama" },
      { name: "Delima" },
      { name: "Galceran" },
      { name: "Miñoza" },
      { name: "Roa J.M." },
      { name: "Timogan" },
      { name: "Yañez" },
    ],
  },
  {
    title: "Short Dipole Antenna Calculator",
    description:
      "Computation logic and formulas for the short dipole antenna model.",
    contributors: [
      { name: "Balabag" },
      { name: "Gaputan" },
      { name: "Jarilla" },
      { name: "Mino" },
      { name: "Roa R.J." },
      { name: "Vale" },
    ],
  },
  {
    title: "Yagi-Uda Antenna Calculator",
    description:
      "Computation logic and formulas for the Yagi-Uda antenna array model.",
    contributors: [
      { name: "Cabalo" },
      { name: "Ganzan" },
      { name: "Hinosolongo" },
      { name: "Pasaje" },
      { name: "Saludes I." },
      { name: "Saludes Z." },
      { name: "Tarde" },
    ],
  },
  {
    title: "Loop Antenna Calculator",
    description:
      "Computation logic and formulas for the small loop antenna model.",
    contributors: [
      { name: "Ampo" },
      { name: "Capanang" },
      { name: "Ellacone" },
      { name: "Emano" },
      { name: "Engaño" },
      { name: "Gamil" },
      { name: "Platitas" },
      { name: "Tampos" },
    ],
  },
];

export function CreditsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 py-10 px-4">
      {/* Page header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Credits &amp; Attributions
        </h2>
        <p className="text-sm text-muted-foreground">
          People behind the calculators and this web application.
        </p>
      </div>

      {/* Course badge */}
      <div className="flex flex-wrap gap-2 text-xs">
        {["ECE 325", "ECE 3A", "BS ECE", "A.Y. 2025–2026"].map((tag) => (
          <span
            key={tag}
            className="rounded-md border bg-muted px-2.5 py-1 font-medium text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.title} className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {section.title}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {section.description}
              </p>
            </div>
            <div className="rounded-lg border bg-card divide-y">
              {section.contributors.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <span className="text-sm font-medium text-foreground">
                    {c.name}
                  </span>
                  {c.role && (
                    <span className="text-xs text-muted-foreground">
                      {c.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Built-with note */}
      <div className="flex items-center gap-2 border-t pt-6 text-xs text-muted-foreground">
        <Radio className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <span>
          Antenna Calculator — ECE 325, Transmission Media &amp; Antenna System
          Design
        </span>
      </div>
    </div>
  );
}
