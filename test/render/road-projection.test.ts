// RoadRender projection tests. NOT a fidelity gate vs the original (that's the P1
// geometry golden, captured from Ruffle) — these lock the INTERNAL consistency of
// the BuildDrawSegs port (src/render/road-projection.ts): perspective shrink with
// distance, curve = double-integration of changeX, hill = double-integration of
// changeY, sub-segment scroll, and hill-occlusion highestY.
import { describe, it, expect } from "vitest";
import { buildDrawSegs, ROAD_DEFAULTS, type RoadSeg, type Camera3D } from "../../src/render/road-projection";

function seg(over: Partial<RoadSeg> = {}): RoadSeg {
  return { width: 100, changeX: 0, changeY: 0, surfaceIndex: 0, colL: 1, colR: 1, edgeIndexL: 0, edgeIndexR: 0, ...over };
}
const straight = (n: number, over: Partial<RoadSeg> = {}) => Array.from({ length: n }, () => seg(over));
const cam = (x = 0, y = 0, z = 0): Camera3D => ({ x, y, z });

describe("perspective", () => {
  it("scale = fov/(1+z); shrinks with distance", () => {
    const r = buildDrawSegs(straight(50), cam(0, 30, 0), ROAD_DEFAULTS); // camera above the road
    // nearest seg z = ZStepOffset = 0 (integer camЗ) → scale = fov/1 = fov
    expect(r.drawSegs[0].z).toBeCloseTo(0, 9);
    // each subsequent seg is realZStep deeper → strictly smaller projected width
    const w = (i: number) => r.drawSegs[i].x1 - r.drawSegs[i].x0;
    for (let i = 1; i < 40; i++) expect(w(i)).toBeLessThan(w(i - 1));
    // with the camera above the road (cy≠0), far segments converge toward the horizon Y
    expect(Math.abs(r.drawSegs[40].ypos - r.render_cy)).toBeLessThan(Math.abs(r.drawSegs[1].ypos - r.render_cy));
  });

  it("straight, centred road is symmetric about horizonX", () => {
    const r = buildDrawSegs(straight(20), cam(), ROAD_DEFAULTS);
    for (let i = 0; i < 10; i++) {
      const mid = (r.drawSegs[i].x0 + r.drawSegs[i].x1) / 2;
      expect(mid).toBeCloseTo(r.render_cx, 6); // road centre projects to the vanishing point
    }
  });

  it("camera lateral shifts the road the OTHER way (cx0 = -camera.x)", () => {
    const c = buildDrawSegs(straight(10), cam(0), ROAD_DEFAULTS).drawSegs[0];
    const right = buildDrawSegs(straight(10), cam(50), ROAD_DEFAULTS).drawSegs[0]; // camera moves +x
    const midC = (c.x0 + c.x1) / 2, midR = (right.x0 + right.x1) / 2;
    expect(midR).toBeLessThan(midC); // road shifts left on screen
  });
});

describe("curve = double integration of changeX", () => {
  it("constant changeX → lateral centre drifts quadratically", () => {
    const r = buildDrawSegs(straight(12, { changeX: 0.5 }), cam(), ROAD_DEFAULTS);
    const cx = r.drawSegs.map((d) => d.cx);
    expect(cx[0]).toBeCloseTo(0, 9);                 // seg0 before any accumulation
    expect(cx[1]).toBeCloseTo(0.5, 9);               // +rate(0.5)
    expect(cx[2]).toBeCloseTo(1.5, 9);               // +rate(1.0)
    expect(cx[3]).toBeCloseTo(3.0, 9);               // +rate(1.5)
    // second difference is constant (== changeX) — the signature of double integration
    for (let i = 2; i < 10; i++) {
      const d2 = cx[i] - 2 * cx[i - 1] + cx[i - 2];
      expect(d2).toBeCloseTo(0.5, 9);
    }
  });
});

describe("hill = double integration of changeY", () => {
  it("constant changeY → height drifts quadratically; ypos follows", () => {
    const r = buildDrawSegs(straight(12, { changeY: -0.4 }), cam(), ROAD_DEFAULTS);
    const cy = r.drawSegs.map((d) => d.cy);
    for (let i = 2; i < 10; i++) {
      const d2 = cy[i] - 2 * cy[i - 1] + cy[i - 2];
      expect(d2).toBeCloseTo(-0.4, 9);
    }
  });
});

describe("sub-segment scroll", () => {
  it("fractional camera.z offsets the nearest segment depth by -frac*realZStep", () => {
    const r = buildDrawSegs(straight(10), cam(0, 0, 5.25), ROAD_DEFAULTS);
    // ZStepOffset = -(0.25 * 10) = -2.5 → drawSegs[0].z
    expect(r.drawSegs[0].z).toBeCloseTo(-2.5, 9);
    expect(r.render_z0).toBe(5); // int(5.25)
  });
});

describe("wz (texture V source) is absolute world-z", () => {
  it("wz advances by realZStep and tracks camЗ", () => {
    const r = buildDrawSegs(straight(10), cam(0, 0, 3), ROAD_DEFAULTS);
    // camЗ integer → ZStepOffset 0 → wz[i] = i*realZStep + z0*realZStep = (3+i)*10
    expect(r.drawSegs[0].wz).toBeCloseTo(30, 9);
    expect(r.drawSegs[1].wz).toBeCloseTo(40, 9);
  });
});

describe("hill occlusion (highestY)", () => {
  it("a crest clips segments behind it; flat road leaves highestY unset (99999)", () => {
    const flat = buildDrawSegs(straight(30), cam(), ROAD_DEFAULTS);
    // monotonic ypos (no crest) → no entries pushed → highestY stays 99999
    expect(flat.drawSegs.every((d) => d.highestY === 99999)).toBe(true);

    // build a hill then descent so screen-ypos has a local min (a crest)
    const hill: RoadSeg[] = [
      ...straight(6, { changeY: -1.2 }), // road rises (ypos decreases)
      ...straight(10, { changeY: 1.2 }), // road falls (ypos increases) → crest in between
      ...straight(14),
    ];
    const r = buildDrawSegs(hill, cam(), ROAD_DEFAULTS);
    // at least one segment got a finite highestY clip from a detected crest
    expect(r.drawSegs.some((d) => d.highestY < 99999)).toBe(true);
    // render_highestY is the minimum ypos beyond the nearest 5 segs (the crest line)
    const minBeyond5 = Math.min(...r.drawSegs.slice(5).map((d) => d.ypos));
    expect(r.render_highestY).toBeCloseTo(minBeyond5, 6);
  });
});

describe("degenerate inputs", () => {
  it("empty road → empty result", () => {
    const r = buildDrawSegs([], cam(), ROAD_DEFAULTS);
    expect(r.count).toBe(0);
    expect(r.drawSegs).toEqual([]);
  });
  it("camera past the end draws nothing (z1 clamps below z0 → count 0), no throw", () => {
    // faithful: AS3 clamps z1 and z0>=0 but NOT z0 to the array length, so a camera
    // past the road yields n = z1 - z0 <= 0 → empty (the lap logic keeps camЗ in range).
    const r = buildDrawSegs(straight(8), cam(0, 0, 100), ROAD_DEFAULTS);
    expect(r.count).toBe(0);
    expect(r.drawSegs).toEqual([]);
  });
});
