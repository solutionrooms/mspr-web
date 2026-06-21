/**
 * Road raster (mspr render) — GPU port of RoadRender_BitmapLine.Render
 * (EditorPackage/RoadEditor/RoadRender_BitmapLine.as:29-211). Draws the pseudo-3D
 * road from the projected draw-segments (road-projection.buildDrawSegs):
 *   1. background (parallax bg clip + sky/ground colour bands above/below it),
 *   2. road surface as far→near TRAPEZOID quads (the software path rasters per-
 *      scanline affine strips; a GPU trapezoid is linear-across-trapezoid — visually
 *      ~identical for a road; tessellate into strips if a future diff shows it),
 *      with the surface texture tiling on V (= world-z, the forward-motion scroll) and
 *      hill-occlusion via per-seg `highestY` (RoadRender_BitmapLine.as:123),
 *   3. left/right edge strips (sidetex) from the screen edge to the road edge.
 *
 * Per-object sprites (cars/billboards) are NOT drawn here — they go through
 * compositor.drawSprite at their projected (x,y,scale) (P4).
 */
import type { Compositor } from "./compositor";
import type { DrawSegResult, RoadConstants } from "./road-projection";

export interface RoadTextures {
  /** roadtex[frame] / sidetex[frame] / bg[frame] are 1-based by SWF frame (index 0 unused). */
  roadtex: (WebGLTexture | null)[];
  sidetex: (WebGLTexture | null)[];
  bg: (WebGLTexture | null)[];
  /** surfaceIndex → roadtex frame; edgeIndex → sidetex frame (from roaddata). */
  surfaceFrameByIndex: number[];
  edgeFrameByIndex: number[];
}

export interface RoadRenderOpts {
  bgFrame: number;          // GameVars.currentBackgroundFrame (1-based)
  parallaxX: number;        // GameVars.playerRot — bg horizontal parallax
  bgYPos: number;           // playeryBackgroundYpos + horizonY (+ clip yoffset)
  skyColor: [number, number, number, number];
  groundColor: [number, number, number, number];
  texHeight?: number;       // road/edge texture height (256)
  edges?: boolean;          // draw L/R edge strips (default true)
  consts: RoadConstants;
}

const TEX_H = 256;

export function renderRoad(comp: Compositor, dr: DrawSegResult, tex: RoadTextures, opts: RoadRenderOpts): void {
  const W = comp.width; // stage width (640)
  const segs = dr.drawSegs;
  const n = dr.count;
  const th = opts.texHeight ?? TEX_H;
  const tzs = opts.consts.textureZScale;

  // --- 1. background: sky band, bg clip, ground band (RoadRender_BitmapLine.as:58-89) ---
  const top = Math.max(0, Math.min(dr.render_highestY, comp.height));
  // sky fills above the bg, ground below — simplest faithful approximation: bands then bg over.
  comp.drawSolidQuad([0, 0, W, 0, 0, top, W, top], opts.skyColor);
  const bgTex = tex.bg[opts.bgFrame] ?? null;
  if (bgTex) {
    // bg clip drawn full-width at bgYPos with horizontal parallax (REPEAT not needed — clamp)
    const bgH = comp.height;
    const y0 = 0, y1 = bgH;
    // parallax: shift U by parallaxX/clipWidth; here we just translate the quad in X a little
    const px = -opts.parallaxX;
    comp.drawQuad(bgTex, [px, y0, px + W, y0, px, y1, px + W, y1], [0, 0, 1, 0, 0, 1, 1, 1], { blend: "normal" });
  }

  // --- 2. road surface: far → near trapezoids (painter's order; near draws over far) ---
  for (let k = n - 1; k >= 1; k--) {
    const far = segs[k];
    const near = segs[k - 1];
    if (far.ypos >= far.highestY) continue;          // hidden behind a hill crest
    const frame = tex.surfaceFrameByIndex[far.surface] ?? 1;
    const rt = tex.roadtex[frame] ?? tex.roadtex[1] ?? null;
    if (!rt) continue;
    const vFar = (far.wz * tzs) / th;
    const vNear = (near.wz * tzs) / th;
    // winding [TL,TR,BL,BR]: TL=far-left, TR=far-right, BL=near-left, BR=near-right
    comp.drawQuad(
      rt,
      [far.x0, far.ypos, far.x1, far.ypos, near.x0, near.ypos, near.x1, near.ypos],
      [0, vFar, 1, vFar, 0, vNear, 1, vNear],
      { blend: "normal" },
    );
  }

  // --- 3. edges: screen-edge → road-edge strips (RoadRender_BitmapLine.as:148-184) ---
  if (opts.edges !== false) {
    for (let k = n - 1; k >= 1; k--) {
      const far = segs[k];
      const near = segs[k - 1];
      if (far.ypos >= far.highestY) continue;
      const vFar = (far.wz * tzs) / th;
      const vNear = (near.wz * tzs) / th;
      if (far.colL !== 0) {
        const et = tex.sidetex[tex.edgeFrameByIndex[far.edgeIndexL] ?? 1] ?? null;
        if (et) comp.drawQuad(et, [0, far.ypos, far.x0, far.ypos, 0, near.ypos, near.x0, near.ypos],
          [0, vFar, 1, vFar, 0, vNear, 1, vNear], { blend: "normal" });
      }
      if (far.colR !== 0) {
        const et = tex.sidetex[tex.edgeFrameByIndex[far.edgeIndexR] ?? 1] ?? null;
        if (et) comp.drawQuad(et, [far.x1, far.ypos, W, far.ypos, near.x1, near.ypos, W, near.ypos],
          [0, vFar, 1, vFar, 0, vNear, 1, vNear], { blend: "normal" });
      }
    }
  }
}
