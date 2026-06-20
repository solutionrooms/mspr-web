// Build a golden-trace harness SWF: inject an AS3 harness as the document class
// `Preloader` into a copy of the shipped mspaintracer.swf via ffdec `-replace`, so
// the harness links the ORIGINAL 2010-era Box2DFlash 2.0.2 bytecode that ships in
// the game (byte-identical to FZ3's — see ANALYSIS.md).
//
// Usage: node tools/oracle/build-harness.mjs <harness.as> [out.swf]
//   defaults: out.swf = build/<harness-basename>.swf
//
// ffdec arg order is sensitive (per CLAUDE.md): <in> <out> <DocClass> <file.as>
// The SWF's document class (SymbolClass char id 0) is `Preloader` — NOT `Main`.
// `Main` is the game class the shipped Preloader instantiates AFTER a cpmstar ad
// gate that never completes headless, so a Main-targeted harness never runs. We
// replace the document class itself (same as FZ3) so Ruffle constructs it at once.
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

const harness = process.argv[2];
if (!harness) {
  console.error("usage: node build-harness.mjs <harness.as> [out.swf]");
  process.exit(2);
}
const harnessPath = resolve(harness);
if (!existsSync(harnessPath)) {
  console.error(`harness not found: ${harnessPath}`);
  process.exit(2);
}

const baseSwf = join(repoRoot, "mspaintracer.swf");
const ffdec = join(repoRoot, "tools", "ffdec", "ffdec.jar");
const buildDir = join(repoRoot, "tools", "oracle", "build");
mkdirSync(buildDir, { recursive: true });

const outSwf = process.argv[3]
  ? resolve(process.argv[3])
  : join(buildDir, basename(harnessPath).replace(/\.as$/, "") + ".swf");

console.log(`[build-harness] injecting ${basename(harnessPath)} as document class Preloader -> ${outSwf}`);
execFileSync(
  "java",
  ["-jar", ffdec, "-replace", baseSwf, outSwf, "Preloader", harnessPath],
  { stdio: "inherit" },
);
console.log(`[build-harness] done: ${outSwf}`);
