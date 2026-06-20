# src/render — WebGL2 2D compositor + RoadRender + asset pipeline (render dev)

Owner: **render** (`RENDER_DEV.md`). NOT bound by the Prime Directive — reads
`contracts/render-state.ts` and draws.

Target = the shipped game's **software** renderer reproduced on WebGL2: a 7-layer
compositor, `DisplayObjFrame`-faithful sprite draws (anchor offset + rot + scale + xflip +
full ColorTransform + blend mode normal/add/layer/overlay), and a procedural pseudo-3D
**RoadRender**. `s3d.as` is the batcher *design reference* only (it's dead code in the SWF).

First task: the ½-day spike (`RENDER_DEV.md`) — one sprite (rot/scale/xflip/ColorTransform)
+ one additive particle on real extracted assets, vs a Ruffle reference frame. Also owns the
SWF→atlas pipeline (no prebaked atlas exists — texturepages are disabled in the shipped SWF).
