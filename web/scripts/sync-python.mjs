// Copies the source-of-truth Python calculator files from the repo's
// calculators/ folder into web/public/python/ so the Pyodide worker can
// fetch them at runtime.
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "..", "..", "calculators");
const outDir = resolve(here, "..", "public", "python");

const files = ["short_dipole.py", "loop_antenna.py", "yagi_uda.py", "monopole.py"];

await mkdir(outDir, { recursive: true });

for (const f of files) {
    const src = resolve(srcDir, f);
    const dest = resolve(outDir, f);
    await copyFile(src, dest);
    console.log(`[sync-python] ${f}`);
}
