// Render every SWF sprite frame to PNG via FFDec (step 1 of the atlas pipeline).
// FFDec renders each sprite on its union-bounds canvas, transparency-padded;
// build-atlas.mjs alpha-crops each frame back to the game's baked tight bitmap.
//
// One-time / whenever the SWF changes. Output: tools/atlas/work/sprites/<class>/<frame>.png
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const ffdec = join(repoRoot, "tools", "ffdec", "ffdec.jar");
const swf = join(repoRoot, "mspaintracer.swf");
const out = join(__dirname, "work", "sprites");

mkdirSync(out, { recursive: true });
console.log(`[ffdec-export] rendering sprites -> ${out} (this takes ~70s)`);
execFileSync("java", ["-jar", ffdec, "-format", "sprite:png", "-export", "sprite", out, swf], {
  stdio: "inherit",
});
console.log("[ffdec-export] done");
