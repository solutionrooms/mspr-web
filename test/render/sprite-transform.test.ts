// Render transform tests. NOT a bit-exact physics gate — these lock
// `computeQuad` (src/render/sprite-transform.ts) to the EXACT DisplayObjFrame
// matrix semantics (DisplayObjFrame.as:306 RenderAtRotScaled / :320 _Xflip),
// independently of the algebraic simplification computeQuad uses.
//
// The decisive test reproduces the literal Flash Matrix op sequence here (with
// Flash's left-multiply translate/scale/rotate concatenation) and asserts the
// four transformed corners equal computeQuad's — so any drift in the algebra
// turns red. Plus the load-bearing invariants: pivot→(x,y), flip mirrors X
// after rotation, scale is about the pivot.
import { describe, it, expect } from "vitest";
import { computeQuad, type SpritePlacement } from "../../src/render/sprite-transform";

/** Minimal Flash flash.geom.Matrix: [a c tx; b d ty]. Methods left-multiply
 *  (new op applied in parent space), matching AS3 exactly. */
class Mat {
  a = 1; b = 0; c = 0; d = 1; tx = 0; ty = 0;
  translate(dx: number, dy: number) { this.tx += dx; this.ty += dy; return this; }
  scale(sx: number, sy: number) {
    this.a *= sx; this.c *= sx; this.tx *= sx;
    this.b *= sy; this.d *= sy; this.ty *= sy; return this;
  }
  rotate(q: number) {
    const cos = Math.cos(q), sin = Math.sin(q);
    const a = this.a, b = this.b, c = this.c, d = this.d, tx = this.tx, ty = this.ty;
    this.a = a * cos - b * sin; this.b = a * sin + b * cos;
    this.c = c * cos - d * sin; this.d = c * sin + d * cos;
    this.tx = tx * cos - ty * sin; this.ty = tx * sin + ty * cos;
    return this;
  }
  apply(px: number, py: number): [number, number] {
    return [this.a * px + this.c * py + this.tx, this.b * px + this.d * py + this.ty];
  }
}

// Literal DisplayObjFrame.as matrices, with xoff=-pivotX, yoff=-pivotY (Preparing.as:153).
function refMatrix(p: SpritePlacement): Mat {
  const xoff = -p.pivotX, yoff = -p.pivotY, m = new Mat();
  if (p.xflip) {
    // RenderAtRotScaled_Xflip (DisplayObjFrame.as:320)
    m.translate(xoff, yoff).rotate(p.dir).translate(-xoff, -yoff)
      .scale(p.scale, p.scale).translate(xoff * p.scale, yoff * p.scale)
      .scale(-1, 1).translate(p.x, p.y);
  } else {
    // RenderAtRotScaled (DisplayObjFrame.as:306)
    m.translate(xoff, yoff).rotate(p.dir).translate(-xoff, -yoff)
      .scale(p.scale, p.scale).translate(p.x + xoff * p.scale, p.y + yoff * p.scale);
  }
  return m;
}

const CASES: SpritePlacement[] = [
  { x: 0, y: 0, scale: 1, dir: 0, pivotX: 0, pivotY: 0, w: 10, h: 10, xflip: false },
  { x: 320, y: 240, scale: 1, dir: 0, pivotX: 106, pivotY: 116, w: 213, h: 134, xflip: false },
  { x: 330, y: 250, scale: 1.6, dir: 20 * Math.PI / 180, pivotX: 106, pivotY: 116, w: 213, h: 134, xflip: true },
  { x: 100, y: 400, scale: 0.55, dir: Math.PI / 2, pivotX: 96, pivotY: 135, w: 196, h: 151, xflip: false },
  { x: 50, y: 60, scale: 2.0, dir: -1.2, pivotX: 38.5, pivotY: 38, w: 77, h: 76, xflip: true },
  { x: 639, y: 1, scale: 0.9, dir: 3.0, pivotX: 137, pivotY: 122, w: 297, h: 134, xflip: false },
];

describe("computeQuad === literal DisplayObjFrame matrix", () => {
  for (const [i, p] of CASES.entries()) {
    it(`case ${i} (xflip=${p.xflip}, dir=${p.dir.toFixed(3)})`, () => {
      const q = computeQuad(p);
      const m = refMatrix(p);
      const [ex0, ey0] = m.apply(0, 0);
      const [ex1, ey1] = m.apply(p.w, 0);
      const [ex2, ey2] = m.apply(0, p.h);
      const [ex3, ey3] = m.apply(p.w, p.h);
      expect(q.x0).toBeCloseTo(ex0, 9); expect(q.y0).toBeCloseTo(ey0, 9);
      expect(q.x1).toBeCloseTo(ex1, 9); expect(q.y1).toBeCloseTo(ey1, 9);
      expect(q.x2).toBeCloseTo(ex2, 9); expect(q.y2).toBeCloseTo(ey2, 9);
      expect(q.x3).toBeCloseTo(ex3, 9); expect(q.y3).toBeCloseTo(ey3, 9);
    });
  }
});

describe("invariants", () => {
  it("pivot maps to (x,y) regardless of rot/scale/flip", () => {
    // the bitmap-local point `pivot` is the registration anchor → lands on (x,y).
    for (const p of CASES) {
      const m = refMatrix(p);
      const [px, py] = m.apply(p.pivotX, p.pivotY);
      expect(px).toBeCloseTo(p.x, 9);
      expect(py).toBeCloseTo(p.y, 9);
    }
  });

  it("identity (scale 1, dir 0, pivot 0): TL=(x,y), BR=(x+w,y+h)", () => {
    const q = computeQuad({ x: 5, y: 7, scale: 1, dir: 0, pivotX: 0, pivotY: 0, w: 10, h: 20, xflip: false });
    expect(q.x0).toBeCloseTo(5, 9); expect(q.y0).toBeCloseTo(7, 9);
    expect(q.x3).toBeCloseTo(15, 9); expect(q.y3).toBeCloseTo(27, 9);
  });

  it("x-flip mirrors X about the pivot (no rotation)", () => {
    const base = { x: 100, y: 100, scale: 1, dir: 0, pivotX: 30, pivotY: 10, w: 80, h: 40 };
    const n = computeQuad({ ...base, xflip: false });
    const f = computeQuad({ ...base, xflip: true });
    // pivot stays at x=100; left edge (local 0) was at 100-30=70 → mirrors to 100+30=130
    expect(n.x0).toBeCloseTo(70, 9);
    expect(f.x0).toBeCloseTo(130, 9);
    expect(f.y0).toBeCloseTo(n.y0, 9); // Y unaffected by flip
  });

  it("scale is about the pivot (pivot fixed, extents scale)", () => {
    const p: SpritePlacement = { x: 200, y: 200, scale: 3, dir: 0, pivotX: 10, pivotY: 10, w: 20, h: 20, xflip: false };
    const q = computeQuad(p);
    // local (0,0) is 10px left/up of pivot → at scale 3 it's 30px → (170,170)
    expect(q.x0).toBeCloseTo(170, 9); expect(q.y0).toBeCloseTo(170, 9);
    // local (20,20) is 10px right/down → (230,230)
    expect(q.x3).toBeCloseTo(230, 9); expect(q.y3).toBeCloseTo(230, 9);
  });
});
