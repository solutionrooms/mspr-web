// m3a — standalone narrowphase (collide functions) bit-exact gate.
//
// Mirrors tools/oracle/harness-collide.as: calls b2Collision.b2Collide* on overlapping
// shape pairs with axis-aligned (angle-0) transforms — trig-free, so the manifold math
// (SAT, Sutherland-Hodgman clip, feature ids) is a PURE bit-exact gate. Asserts hex16
// for pointCount/normal and each manifold point's separation/localPoint1/localPoint2/
// id.key. (Rotated narrowphase adds the trig surface — handled per CLAUDE.md rule 5 at
// the level/behavioural layer, not gated bit-exact here.)
//
// CONFIG-INDEPENDENT: shapes/transforms are in Box2D world units (no world/AABB/Step/
// p2w), so this golden is identical to FZ3's — it proves the VENDORED narrowphase
// computes the same bits here.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { b2Collision } from "../src/box2d/Collision/b2Collision";
import { b2Manifold } from "../src/box2d/Collision/b2Manifold";
import { b2XForm } from "../src/box2d/Common/Math/b2XForm";
import { b2CircleDef } from "../src/box2d/Collision/Shapes/b2CircleDef";
import { b2CircleShape } from "../src/box2d/Collision/Shapes/b2CircleShape";
import { b2PolygonDef } from "../src/box2d/Collision/Shapes/b2PolygonDef";
import { b2PolygonShape } from "../src/box2d/Collision/Shapes/b2PolygonShape";
import { f64hex, norm, type Golden } from "./helpers/hex16";

const __dirname = dirname(fileURLToPath(import.meta.url));
const golden: Golden = JSON.parse(readFileSync(join(__dirname, "goldens", "m3a-collide.json"), "utf8"));

type Row = { tag: string; step: number; fields: string[] };
const rows: Row[] = [];
function emit(tag: string, step: number, values: number[]): void {
  rows.push({ tag, step, fields: values.map(f64hex) });
}
function xform(x: number, y: number): b2XForm {
  const xf = new b2XForm();
  xf.position.Set(x, y);
  xf.R.Set(0);
  return xf;
}
function dumpManifold(tag: string, m: b2Manifold): void {
  emit(tag, 0, [m.pointCount, m.normal.x, m.normal.y]);
  for (let i = 0; i < m.pointCount; i++) {
    const p = m.points[i];
    emit(tag + "P", i, [p.separation, p.localPoint1.x, p.localPoint1.y, p.localPoint2.x, p.localPoint2.y, p.id._key]);
  }
}

function run(): void {
  rows.length = 0;
  const c1d = new b2CircleDef();
  c1d.radius = 0.6;
  const c2d = new b2CircleDef();
  c2d.radius = 0.5;
  const mfc = new b2Manifold();
  b2Collision.b2CollideCircles(mfc, new b2CircleShape(c1d), xform(0, 0), new b2CircleShape(c2d), xform(0.8, 0.2));
  dumpManifold("MFC", mfc);

  const boxd = new b2PolygonDef();
  boxd.SetAsBox(1, 0.5);
  const cd = new b2CircleDef();
  cd.radius = 0.4;
  const mfpc = new b2Manifold();
  b2Collision.b2CollidePolygonAndCircle(mfpc, new b2PolygonShape(boxd), xform(0, 0), new b2CircleShape(cd), xform(0.9, 0));
  dumpManifold("MFPC", mfpc);

  const b1d = new b2PolygonDef();
  b1d.SetAsBox(1, 1);
  const b2d = new b2PolygonDef();
  b2d.SetAsBox(1, 1);
  const mfpp = new b2Manifold();
  b2Collision.b2CollidePolygons(mfpp, new b2PolygonShape(b1d), xform(0, 0), new b2PolygonShape(b2d), xform(1.5, 0.3));
  dumpManifold("MFPP", mfpp);
}

describe("m3a — narrowphase collide functions (bit-exact)", () => {
  it("matches the Ruffle golden for circle/poly-circle/poly-poly manifolds", () => {
    run();
    for (const r of rows) {
      const g = golden.golden[r.tag]?.find((x) => x.step === r.step);
      expect(g, `golden missing ${r.tag} row ${r.step}`).toBeTruthy();
      expect(g!.fields.length, `${r.tag} row ${r.step} field count`).toBe(r.fields.length);
      for (let f = 0; f < r.fields.length; f++) {
        expect(
          r.fields[f],
          `${r.tag} row ${r.step} field ${f}: ours=${r.fields[f]} golden=${norm(g!.fields[f])}`,
        ).toBe(norm(g!.fields[f]));
      }
    }
    const goldenCount = Object.values(golden.golden).reduce((n, arr) => n + arr.length, 0);
    expect(rows.length).toBe(goldenCount);
  });
});
