# RENDER_DEV — brief for the renderer developer (mspr)

You own the **WebGL2 renderer** + the **SWF→atlas asset pipeline**. Rendering is **NOT**
bound by the Prime Directive — it reads game state (`contracts/render-state.ts`) and draws;
the fixed 2×(1/80) sim loop owns determinism. You're chosen for visual fidelity + velocity.
Read `CLAUDE.md` "The rendering reality" first — it corrects a wrong first impression.

## The one thing to internalise: the shipped game renders in SOFTWARE, not GPU
The Stage3D batcher `s3d.as` is **dead code** in the shipped SWF (guarded off;
`Game.use_texturepages=false`; **zero** draw-call callers). The live renderer is:
- **`Game.Render(BitmapData)`** — composites ~7 BitmapData layers (background / scroll /
  shadow / road / particle / foreground / hud) via `copyPixels`/`draw`. Layer order +
  per-layer blend are the visual backbone.
- **`DisplayObjFrame.RenderAtRotScaled*`** — blits each sprite: registration offset
  (`xoffset/yoffset`) → x-flip → rotate(dir) → scale → translate; with **full
  ColorTransform (mult+offset)** and a **blend mode**. Variants: `RenderAtRotScaled`
  (normal), `…Additive` (ADD), `…Layer` (LAYER), `…Overlay` (OVERLAY) — see
  `DisplayObjFrame.as:336-376`.
- **`RoadRender`** (`EditorPackage/RoadEditor/Road.as`) — a **procedural pseudo-3D road**
  strip renderer driven by the level road layout + `data/roaddata.json` +
  `data/vars.json` `road_*` constants. This is its own subsystem, not sprite-based.

**Take batcher MECHANICS from `s3d.as`, visual SEMANTICS from the software path.**

## Decision: custom WebGL2 2D compositor (NOT OpenFL)
FZ3 chose OpenFL display-list because FZ3 renders via the Flash display list. mspr does
not — so OpenFL doesn't apply. Build a small WebGL2 sprite/quad compositor instead.
`s3d.as` is an excellent design reference for the batcher (it's the intended GPU path):

### s3d → WebGL2 mapping (from the teardown; `s3d.as` cited inline)
- **Shader:** one program — `gl_Position = uProj * vec4(pos.xy, z, 1)`; `out = texture(tex,
  uv) * vColor`. (s3d program0, AGAL: `tex … ; mul ft0,ft0,v1 ; mov oc,ft0`.) Trivial GLSL.
- **Vertex format:** interleaved `[posX:f32, posY:f32, u:f32, v:f32, color:u8×4]`, stride
  20B → `vertexAttribPointer` pos`(2,FLOAT,0)`, uv`(2,FLOAT,8)`, color`(4,UNSIGNED_BYTE,
  normalized,16)`. 16-bit indices, quad winding `[0,1,2,1,3,2]`. (s3d.as:221-223.)
- **Projection:** orthographic, **origin top-left, Y-DOWN, flipped to clip space**
  (`scale(1,-1,1)`), 640×480 — bake into `uProj`. World scroll is **CPU-baked** (camera
  subtracted) → the GPU gets screen pixels. (s3d.as:159-165; Camera.as.)
- **Batching:** one VBO, append quads, **flush on texture change** (per-atlas-page draw
  calls); orphaned dynamic buffer (or mirror s3d's 16-buffer ring). (s3d.as:604, 856.)
- **Atlas:** POT pages (2048²), `TEXTURE_WRAP=REPEAT`, `LINEAR`, no mips. WebGL has no BGRA
  upload — swizzle at decode or `.bgra` in the FS. UVs are edge-aligned `x/width` (expect
  seam bleed with LINEAR+REPEAT unless the packer pads). (TexturePage.as:55-86.)

### The 3 trickiest things (the teardown's priority order)
1. **Blend-mode parity is NOT in s3d** (it hardcodes one alpha-over blend). You need
   `normal` (alpha-over), `add` (`blendFunc(SRC_ALPHA, ONE)`), and `layer`/`overlay`
   (no WebGL `blendFunc` equivalent → shader-side blend / framebuffer read). Source the
   per-effect blend from the software `DisplayObjFrame`/particle paths. **#1 visual risk.**
2. **Full ColorTransform.** s3d only bakes offsets-as-tint and ignores the alpha
   *multiplier* the software path uses for fades. Implement `out = texel * mult + offset`
   (proper alpha). Cars flash/recolour and UI fades depend on this.
3. **Coordinate / anchor conventions.** Reproduce the exact ortho (top-left, Y-flip,
   640×480) and per-sprite `xoff/yoff` registration (cars: `data/caroffsets.json`) or
   sprites land in the wrong place.

## Asset pipeline (your second deliverable)
The shipped game blits SWF symbol bitmaps directly (texturepages disabled), so there's no
prebaked atlas to reuse. Build the pipeline:
- Extract the symbol bitmaps/shapes from `mspaintracer.swf` (FFDec `-export image/shape`, or
  render symbols) → pack into atlas page(s) → emit atlas + UV/anchor metadata.
- `data/caroffsets.json` gives car sprite pivots; `extracted/binaryData/486_…font…` is the
  BMFont (Komika Axis 28) glyph atlas for text.
- The atlas key the renderer addresses = the SWF **clip/linkage name** used in
  `data/physobjs.json` `graphics[].clip`, `data/roaddata.json` billboard `mc`, etc.

## FIRST TASK — spike (½ day), post results `To: game`
Stand up the WebGL2 compositor and prove the hard bits on real assets:
1. Draw one extracted sprite with rotation + scale + **x-flip** + a **ColorTransform**
   recolour, at a known `xoff/yoff` anchor.
2. Draw one **additive-blend** particle (e.g. nitro/flame) over it.
3. Confirm the ortho/anchor matches a reference frame from the original (Ruffle screenshot).
If those land, the WebGL-compositor architecture is confirmed and we proceed to layers +
the procedural RoadRender. Consume `contracts/render-state.ts` (provisional — propose
refinements as you learn the draw paths; the road `RoadState` shape is deliberately open
and we co-design it).
