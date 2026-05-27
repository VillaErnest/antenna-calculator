## Repository layout

```
antenna-calculator/
├── calculators/             ← Source of truth (CLI + importable Python modules)
│   ├── short_dipole.py
│   ├── loop_antenna.py
│   ├── yagi_uda.py
│   └── monopole.py
└── web/                     ← React + Vite front-end (Pyodide in worker)
    ├── public/python/       ← Auto-copied from ../calculators/ on dev/build
    ├── src/
    │   ├── workers/pyodide.worker.ts
    │   ├── lib/use-pyodide.ts
    │   └── components/
    └── package.json
```

## Tech stack

| Layer | Choice |
|------|--------|
| Build | Vite 5 + React 18 + TypeScript |
| Styling | Tailwind CSS + shadcn-style primitives |
| Python runtime | Pyodide 0.26 in a Web Worker (numpy, scipy preloaded) |
| Charts | Plotly.js (native polar plots for radiation patterns) |
| PDF export | jsPDF + jspdf-autotable |
| Hosting | Netlify (static — see `web/netlify.toml`) |

## Development

```bash
cd web
npm install
npm run dev
```

The `predev`/`prebuild` hook copies `calculators/*.py` into
`web/public/python/`, so editing a calculator file is picked up on
the next dev/build run.

## CLI usage

Each calculator file remains runnable on its own:

```bash
python calculators/short_dipole.py
python calculators/loop_antenna.py
```

`pyperclip` and `reportlab` are only required for the optional CLI
copy / PDF-export features in `calculators/short_dipole.py`.

## Deploying to Netlify

The repo includes `web/netlify.toml`. Either:

1. Connect this Git repo to Netlify — it will use base directory `web`,
   build command `npm run build`, publish directory `dist`.
2. Or run `cd web && npm run build` and drag-and-drop `web/dist`.

The first page load downloads Pyodide + numpy + scipy from
`cdn.jsdelivr.net` (~10–15 MB). Subsequent visits use the browser cache.
