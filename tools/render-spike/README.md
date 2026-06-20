# render-spike — WebGL2 compositor vs Flash/Ruffle parity

The ½-day RENDER spike (`RENDER_DEV.md`). Proves the WebGL2 2D compositor
(`src/render/`) reproduces the shipped game's **software** `DisplayObjFrame` draws
on **real extracted assets**, checked pixel-for-pixel against the original running
under Ruffle.

## What it proves (the 3 hard things + x-flip)
1. **anchor / ortho** — top-left origin, Y-down, 640×480; per-sprite pivot from
   `caroffsets.json` (`Preparing.as:153` → `xoffset = -xoff`).
2. **rot + scale + x-flip** — exact `DisplayObjFrame.RenderAtRotScaled[_Xflip]`
   matrix (`DisplayObjFrame.as:306/320`); algebra in `src/render/sprite-transform.ts`.
3. **full ColorTransform** — `out = texel*mult + offset` (`RENDER_DEV.md` #2).
4. **additive blend** — premult `(ONE,ONE)`, the brief's #1 visual risk.

## Run
```
npm run atlas:ffdec && npm run atlas:build   # one-time: SWF -> src/render/assets/atlas.{png,json}
npm run spike                                 # build ref SWF, render both, diff
```
Outputs (gitignored, SWF-derived art) in `out/`: `webgl.png`, `ruffle.png`,
`diff.png`, `sidebyside.png` (webgl | ruffle | diff).

## How parity is measured
`scene.json` is the **single source of truth** for the test scene, consumed by
BOTH renderers:
- `spike-main.ts` → WebGL2 compositor in headless Chrome (esbuild bundle, swiftshader).
- `harness-spike.as` → injected as the document class `Preloader` into a copy of
  `mspaintracer.swf`, run under Ruffle headless. Rasterises the shipped `Cars` /
  `fx_nitro` symbols (the same art the atlas packs) and composites with the
  **literal** `DisplayObjFrame` matrix sequences + `ColorTransform` + `BlendMode`
  — an independent check of `computeQuad`'s algebra.

`harness-spike.as` runs as the **document class**, which Ruffle constructs *early*
(it's the streaming preloader), before the `Cars`/`fx_nitro` `SymbolClass` tags
later in the timeline. So it polls `ENTER_FRAME` until those symbols resolve, then
renders and traces `[READY]`.

## Result (latest run)
- mean abs channel error **0.685 / 255**; **98.0 %** of pixels exact-ish (≤2),
  **99.0 %** ≤32. The ~1 % >32 is **edge AA / sampling** (GPU quad-raster vs Flash
  inverse-map nearest) plus the nitro glow.
- **Car** (lossless `DefineBitsLossless` source): diff is edge-only → normal blend,
  ColorTransform, rot/scale/x-flip, anchor/ortho all correct.
- **Additive control** (a Cars frame drawn additive, top-left): diff edge-only →
  **additive-blend math is correct**.
- **Nitro** (lossy `DefineShape → DefineBitsJPEG3` source): a soft noise blob in the
  diff = **JPEG-decode divergence** between FFDec (atlas) and Ruffle, amplified by
  additive blend. NOT a compositor bug; it's an atlas-fidelity caveat for JPEG art.
