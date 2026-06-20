// SWF -> atlas pipeline (mspr render dev)
// ---------------------------------------------------------------------------
// The shipped SWF disables texturepages (Game.use_texturepages=false), so there
// is NO prebaked atlas to reuse. The game bakes each MovieClip frame to a tight
// BitmapData at load (GraphicObjects) and blits it via DisplayObjFrame. We
// reproduce that baking offline:
//
//   1. FFDec renders every sprite frame to PNG on the sprite's UNION-bounds
//      canvas (padded with transparency).  `npm run atlas:ffdec` does this once.
//   2. We alpha-crop each frame to its tight content box (== what the game baked;
//      proven: crop width === data/caroffsets.json width for all 12 Cars frames).
//   3. We shelf-pack the crops into POT atlas page(s) with a transparent gutter
//      and emit atlas.json keyed by the SWF *clip/linkage name* (the same key the
//      renderer addresses: physobjs[].graphics[].clip, roaddata billboard .mc,
//      caroffsets[].mcname, etc).
//
// Atlas key = SWF clip name; each key has N frames (0-based). Per frame we store
// the page UV rect (px + normalised) and the PIVOT (the bitmap-local point that
// lands on the RenderObj (x,y) -- see src/render/sprite-transform.ts).
//   - cars: pivot = caroffsets (xoff,yoff)  [authored rotation centre]
//   - others: pivot = sprite registration (0,0) mapped into the crop; for the
//     spike, particles default to content-centre (TODO: derive registration from
//     DefineSprite bounds -- a known refinement, see DEVELOPER_MESSAGES).
//
// Usage:
//   node tools/atlas/build-atlas.mjs                 # build from default manifest
//   node tools/atlas/ffdec-export.mjs                # (re)render sprite PNGs first
import { PNG } from "pngjs";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const SPRITES = join(__dirname, "work", "sprites");
const OUT_DIR = join(repoRoot, "src", "render", "assets");

// --- manifest: which SWF clips go in the atlas, + per-clip pivot strategy -----
// `dir` is auto-resolved by class name from the FFDec sprite export.
const caroffsets = JSON.parse(readFileSync(join(repoRoot, "data", "caroffsets.json"), "utf8"));

const MANIFEST = [
  { clip: "Cars",        classDir: "DefineSprite_1030_Cars_Cars",                pivot: "caroffsets" },
  { clip: "fx_nitro",    classDir: "DefineSprite_1233_fx_nitro_fx_nitro",        pivot: "center" },
  { clip: "flames",      classDir: "DefineSprite_1219_flames_flames",            pivot: "center" },
  { clip: "TurboPickup", classDir: "DefineSprite_1222_TurboPickup_TurboPickup",  pivot: "center" },
];

const GUTTER = 2; // transparent border around each sprite to kill LINEAR bleed

// --- helpers ----------------------------------------------------------------
function loadPng(path) {
  return PNG.sync.read(readFileSync(path));
}

/** Alpha-crop to the tight content box. Returns the cropped PNG + content origin. */
function alphaCrop(png) {
  const { width: W, height: H, data } = png;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (data[(y * W + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) { // fully transparent frame
    return { cw: 1, ch: 1, minX: 0, minY: 0, pixels: Buffer.alloc(4) };
  }
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const pixels = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const srcOff = ((minY + y) * W + minX) * 4;
    png.data.copy(pixels, y * cw * 4, srcOff, srcOff + cw * 4);
  }
  return { cw, ch, minX, minY, pixels };
}

function frameFilesOf(classDir) {
  const dir = join(SPRITES, classDir);
  if (!existsSync(dir)) throw new Error(`sprite export not found: ${dir}\n  run: node tools/atlas/ffdec-export.mjs`);
  return readdirSync(dir)
    .filter((f) => /^\d+\.png$/.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map((f) => join(dir, f));
}

// --- 1. load + crop every frame of every clip -------------------------------
const sprites = []; // {clip, frame, cw, ch, minX, minY, canvasW, canvasH, pixels, pivotX, pivotY}
for (const m of MANIFEST) {
  const files = frameFilesOf(m.classDir);
  files.forEach((file, frame) => {
    const png = loadPng(file);
    const c = alphaCrop(png);
    let pivotX, pivotY;
    if (m.pivot === "caroffsets") {
      const o = caroffsets.find((r) => r.mcname === "Cars" && +r.mcframe === frame);
      if (!o) throw new Error(`no caroffsets row for ${m.clip} frame ${frame}`);
      pivotX = +o.xoff;
      pivotY = +o.yoff;
    } else { // "center" — content centre (spike default for particles)
      pivotX = c.cw / 2;
      pivotY = c.ch / 2;
    }
    sprites.push({
      clip: m.clip, frame, cw: c.cw, ch: c.ch,
      canvasW: png.width, canvasH: png.height, minX: c.minX, minY: c.minY,
      pixels: c.pixels, pivotX, pivotY,
    });
  });
}

// --- 2. shelf-pack into the smallest POT square page ------------------------
function nextPot(n) { let p = 1; while (p < n) p <<= 1; return p; }

function shelfPack(items, pageSize) {
  let x = GUTTER, y = GUTTER, shelfH = 0;
  for (const it of items) {
    const w = it.cw + GUTTER, h = it.ch + GUTTER;
    if (x + w > pageSize) { x = GUTTER; y += shelfH; shelfH = 0; }
    if (y + h > pageSize) return false; // doesn't fit
    it.ax = x; it.ay = y;
    x += w;
    if (h > shelfH) shelfH = h;
  }
  return true;
}

// sort tallest-first for tighter shelves
sprites.sort((a, b) => b.ch - a.ch);
const totalArea = sprites.reduce((s, it) => s + (it.cw + GUTTER) * (it.ch + GUTTER), 0);
let pageSize = nextPot(Math.ceil(Math.sqrt(totalArea)));
while (!shelfPack(sprites, pageSize)) pageSize <<= 1;
if (pageSize > 8192) throw new Error("atlas exceeds 8192 (max texture); split into pages");

// --- 3. blit into the page + emit -------------------------------------------
const page = new PNG({ width: pageSize, height: pageSize });
page.data.fill(0);
for (const it of sprites) {
  for (let row = 0; row < it.ch; row++) {
    const dstOff = ((it.ay + row) * pageSize + it.ax) * 4;
    it.pixels.copy(page.data, dstOff, row * it.cw * 4, (row + 1) * it.cw * 4);
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "atlas.png"), PNG.sync.write(page));

// group frames back by clip, in frame order
const clips = {};
for (const it of sprites) (clips[it.clip] ??= []).push(it);
for (const k of Object.keys(clips)) clips[k].sort((a, b) => a.frame - b.frame);

const atlas = {
  meta: {
    source: "mspaintracer.swf via FFDec sprite render + alpha-crop",
    page: "atlas.png",
    pageW: pageSize, pageH: pageSize, gutter: GUTTER,
    note: "key = SWF clip/linkage name; pivot is bitmap-local px that maps to RenderObj (x,y). " +
          "cars pivot = caroffsets; others = content-centre (spike).",
  },
  clips: Object.fromEntries(
    Object.entries(clips).map(([clip, frames]) => [
      clip,
      frames.map((it) => ({
        frame: it.frame,
        x: it.ax, y: it.ay, w: it.cw, h: it.ch,
        u0: it.ax / pageSize, v0: it.ay / pageSize,
        u1: (it.ax + it.cw) / pageSize, v1: (it.ay + it.ch) / pageSize,
        pivotX: it.pivotX, pivotY: it.pivotY,
      })),
    ]),
  ),
};
writeFileSync(join(OUT_DIR, "atlas.json"), JSON.stringify(atlas, null, 2));

const nClips = Object.keys(clips).length;
const nFrames = sprites.length;
console.log(`[atlas] ${nClips} clips, ${nFrames} frames -> ${pageSize}x${pageSize} page`);
for (const [clip, frames] of Object.entries(clips))
  console.log(`[atlas]   ${clip}: ${frames.length} frames`);
console.log(`[atlas] wrote ${join(OUT_DIR, "atlas.png")}`);
console.log(`[atlas] wrote ${join(OUT_DIR, "atlas.json")}`);
