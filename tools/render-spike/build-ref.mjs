// Build the Ruffle parity-reference SWF: inject harness-spike.as as the document
// class `Preloader` (char id 0) into a copy of mspaintracer.swf. Run under Ruffle
// by run-ruffle.mjs. (ffdec arg order: <in> <out> <DocClass> <file.as>.)
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const ffdec = join(repoRoot, "tools", "ffdec", "ffdec.jar");
const baseSwf = join(repoRoot, "mspaintracer.swf");
const harness = join(__dirname, "harness-spike.as");
const outDir = join(__dirname, "out");
mkdirSync(outDir, { recursive: true });
const outSwf = join(outDir, "spike-ref.swf");

console.log(`[build-ref] injecting harness-spike.as as Preloader -> ${outSwf}`);
execFileSync("java", ["-jar", ffdec, "-replace", baseSwf, outSwf, "Preloader", harness], { stdio: "inherit" });
console.log("[build-ref] done");
