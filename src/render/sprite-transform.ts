/**
 * DisplayObjFrame-faithful sprite transform (mspr render).
 *
 * Reproduces the exact screen-space placement of DisplayObjFrame.RenderAtRotScaled
 * and RenderAtRotScaled_Xflip (extracted/scripts/DisplayObjFrame.as:306-334), which
 * the software renderer uses for every gameplay sprite (cars, pickups, road objects).
 *
 * DERIVATION (RenderAtRotScaled, DisplayObjFrame.as:306):
 *   Flash Matrix ops post-concatenate (M' = OP * M), so the sequence
 *     translate(o); rotate(d); translate(-o); scale(s); translate(x+o*s, y+o*s)
 *   composes to  M = T(x+o·s) · S(s) · T(-o) · R(d) · T(o), and applying M to a
 *   bitmap-local point p telescopes (the ±o·s terms cancel) to:
 *
 *       screen = s · R(d) · (p + o) + (x, y)               ... (normal)
 *
 *   where o = (xoffset, yoffset). The game sets o = (-xoff, -yoff) from
 *   caroffsets.json (Preparing.as:153 `xoffset = -xoff`), so writing the PIVOT
 *   pivot = (xoff, yoff) = -o:
 *
 *       screen = s · R(d) · (p - pivot) + (x, y)
 *
 *   i.e. the bitmap-local point `pivot` lands exactly on (x, y), invariant of
 *   rotation/scale. For cars, pivot is the authored rotation centre (caroffsets).
 *
 * X-FLIP (RenderAtRotScaled_Xflip, DisplayObjFrame.as:320) telescopes to:
 *
 *       screen = (x, y) + flipX( s · R(d) · (p - pivot) )   ... flipX negates X
 *                                                                AFTER rot+scale
 *   Visually this mirrors the sprite AND its rotation (flipX·R(d) = R(-d)·flipX),
 *   which is what a car facing the other way needs. The pivot still maps to (x,y).
 *
 * Rotation matches Flash Matrix.rotate(d): a=cos,b=sin,c=-sin,d=cos, so
 *   R(d)·(vx,vy) = (cos·vx - sin·vy, sin·vx + cos·vy).
 */

export interface SpritePlacement {
  /** Screen-space anchor (px, camera already baked in). The pivot lands here. */
  x: number;
  y: number;
  /** Uniform scale. */
  scale: number;
  /** Rotation in RADIANS (Flash convention; +ve = clockwise on the y-down stage). */
  dir: number;
  /** Bitmap-local pivot (px from the crop's top-left). Cars: caroffsets xoff/yoff. */
  pivotX: number;
  pivotY: number;
  /** Cropped sprite size (px). */
  w: number;
  h: number;
  /** Horizontal flip (mirrors sprite + rotation, per RenderAtRotScaled_Xflip). */
  xflip: boolean;
}

/** Four screen-space quad corners in order [TL, TR, BL, BR] (matches the
 *  MakeVertexBuffer winding (0,0)(w,0)(0,h)(w,h) — DisplayObjFrame.as:129-191). */
export interface QuadCorners {
  x0: number; y0: number; // TL  (local 0,0)
  x1: number; y1: number; // TR  (local w,0)
  x2: number; y2: number; // BL  (local 0,h)
  x3: number; y3: number; // BR  (local w,h)
}

export function computeQuad(p: SpritePlacement): QuadCorners {
  const cos = Math.cos(p.dir);
  const sin = Math.sin(p.dir);
  const sx = p.xflip ? -1 : 1;

  // map one bitmap-local corner (lx,ly) -> screen
  const map = (lx: number, ly: number): [number, number] => {
    // (p - pivot) * scale
    const dx = (lx - p.pivotX) * p.scale;
    const dy = (ly - p.pivotY) * p.scale;
    // R(dir)
    let rx = cos * dx - sin * dy;
    const ry = sin * dx + cos * dy;
    // flipX AFTER rotation (X-flip semantics)
    rx *= sx;
    return [p.x + rx, p.y + ry];
  };

  const [x0, y0] = map(0, 0);
  const [x1, y1] = map(p.w, 0);
  const [x2, y2] = map(0, p.h);
  const [x3, y3] = map(p.w, p.h);
  return { x0, y0, x1, y1, x2, y2, x3, y3 };
}
