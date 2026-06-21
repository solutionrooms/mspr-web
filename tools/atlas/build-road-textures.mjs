// Road-texture pipeline (mspr render) — extracts the road surface / edge / background
// clips as STANDALONE textures (NOT atlas sub-rects): the road surface + edges tile
// vertically (V = world-z), so they need TEXTURE_WRAP=REPEAT, which atlas packing
// (CLAMP, shared page) can't provide. roadtex/sidetex are 256x256 POT (REPEAT-ready);
// bg is 640x640.
//
// Emits src/render/assets/road/{roadtex_N,sidetex_N,bg_N}.png (1-based frame N, matching
// roaddata surface/edge .frame) + road-textures.json with the index→frame maps
// (RoadData.GetRoadSurfaceDefByIndex(surfaceIndex).frame → roadtex frame; same for edges).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const SPRITES = join(__dirname, "work", "sprites");
const OUT = join(repoRoot, "src", "render", "assets", "road");
mkdirSync(OUT, { recursive: true });

const CLIPS = {
  roadtex: "DefineSprite_657_roadtex_roadtex",
  sidetex: "DefineSprite_1052_sidetex_sidetex",
  bg: "DefineSprite_604_bg_bg",
};

const meta = { textures: {} };
for (const [name, dir] of Object.entries(CLIPS)) {
  const src = join(SPRITES, dir);
  if (!existsSync(src)) throw new Error(`missing sprite export ${src}; run: node tools/atlas/ffdec-export.mjs`);
  const frames = readdirSync(src).filter((f) => /^\d+\.png$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
  meta.textures[name] = frames.map((f) => parseInt(f)); // 1-based frame ids present
  for (const f of frames) copyFileSync(join(src, f), join(OUT, `${name}_${parseInt(f)}.png`));
}

// index→frame maps from roaddata (RoadData surfaces/edges array order = the index)
const roaddata = JSON.parse(readFileSync(join(repoRoot, "data", "roaddata.json"), "utf8"));
meta.surfaceFrameByIndex = roaddata.roadsurfaces.map((s) => +s.frame); // surfaceIndex → roadtex frame
meta.edgeFrameByIndex = roaddata.edgesegments.map((e) => +e.frame);    // edgeIndex → sidetex frame
meta.surfaceNames = roaddata.roadsurfaces.map((s) => s.name);
meta.edgeNames = roaddata.edgesegments.map((e) => e.name);

writeFileSync(join(OUT, "road-textures.json"), JSON.stringify(meta, null, 2));
console.log(`[road-tex] roadtex ${meta.textures.roadtex.length}f, sidetex ${meta.textures.sidetex.length}f, bg ${meta.textures.bg.length}f -> ${OUT}`);
console.log(`[road-tex] surfaceFrameByIndex: ${meta.surfaceFrameByIndex.join(",")}`);
console.log(`[road-tex] edgeFrameByIndex: ${meta.edgeFrameByIndex.join(",")}`);
