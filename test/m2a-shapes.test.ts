// m2a — shape construction + ComputeMass bit-exact gate (broadphase-free).
//
// Builds the same standalone shapes as tools/oracle/harness-shapes.as in the ported
// (vendored-from-FZ3) TS engine and asserts hex16(ours) === golden for ComputeMass
// (mass/centre/inertia), the polygon centroid, OBB (centre/extents/R), the TOI-slop
// core vertices, and the edge normals. All quantities are +-*/ and sqrt (no trig) so
// this is a PURE bit-exact gate — the load-bearing mass/inertia path that feeds
// invMass/invI/localCenter.
//
// CONFIG-INDEPENDENT: shapes are defined in Box2D world units (no world/AABB/Step/
// p2w), so this golden is identical to FZ3's — it proves the VENDORED engine links
// and computes the same bits here. (The config-dependent gate is m2b broadphase.)
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { b2CircleDef } from "../src/box2d/Collision/Shapes/b2CircleDef";
import { b2CircleShape } from "../src/box2d/Collision/Shapes/b2CircleShape";
import { b2PolygonDef } from "../src/box2d/Collision/Shapes/b2PolygonDef";
import { b2PolygonShape } from "../src/box2d/Collision/Shapes/b2PolygonShape";
import { b2MassData } from "../src/box2d/Collision/Shapes/b2MassData";
import { f64hex, norm, type Golden } from "./helpers/hex16";

const __dirname = dirname(fileURLToPath(import.meta.url));
const golden: Golden = JSON.parse(readFileSync(join(__dirname, "goldens", "m2a-shapes.json"), "utf8"));

// Accumulates (tag,row,fields) exactly as the AS3 harness `emit(...)` does, so the
// two structures can be compared element-for-element.
type Row = { tag: string; step: number; fields: string[] };
const rows: Row[] = [];
function emit(tag: string, step: number, values: number[]): void {
  rows.push({ tag, step, fields: values.map(f64hex) });
}

function dumpPoly(tag: string, poly: b2PolygonShape): void {
  const md = new b2MassData();
  poly.ComputeMass(md);
  emit(tag, 0, [md.mass, md.center.x, md.center.y, md.I]);
  emit(tag, 1, [poly.m_centroid.x, poly.m_centroid.y]);
  emit(tag, 2, [
    poly.m_obb.center.x,
    poly.m_obb.center.y,
    poly.m_obb.extents.x,
    poly.m_obb.extents.y,
    poly.m_obb.R.col1.x,
    poly.m_obb.R.col1.y,
    poly.m_obb.R.col2.x,
    poly.m_obb.R.col2.y,
  ]);
  for (let v = 0; v < poly.m_vertexCount; v++) {
    emit(tag + "CORE", v, [poly.m_coreVertices[v].x, poly.m_coreVertices[v].y]);
  }
  for (let v = 0; v < poly.m_vertexCount; v++) {
    emit(tag + "NORM", v, [poly.m_normals[v].x, poly.m_normals[v].y]);
  }
}

function buildAll(): void {
  rows.length = 0;
  const cd = new b2CircleDef();
  cd.radius = 0.6;
  cd.density = 0.3;
  cd.localPosition.Set(0.2, -0.1);
  const circle = new b2CircleShape(cd);
  const md = new b2MassData();
  circle.ComputeMass(md);
  emit("CIRC", 0, [md.mass, md.center.x, md.center.y, md.I]);

  const triDef = new b2PolygonDef();
  triDef.density = 0.3;
  triDef.vertexCount = 3;
  triDef.vertices[0].Set(-1, -0.5);
  triDef.vertices[1].Set(1, -0.5);
  triDef.vertices[2].Set(0.3, 0.8);
  dumpPoly("TRI", new b2PolygonShape(triDef));

  const boxDef = new b2PolygonDef();
  boxDef.density = 0.5;
  boxDef.SetAsBox(1.2, 0.4);
  dumpPoly("BOX", new b2PolygonShape(boxDef));
}

describe("m2a — shapes + ComputeMass (bit-exact)", () => {
  it("matches the Ruffle golden for every shape quantity", () => {
    buildAll();
    // Compare our emitted structure against the golden, tag by tag, row by row.
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
    // And confirm we covered every golden row (no silent under-emission).
    const goldenCount = Object.values(golden.golden).reduce((n, arr) => n + arr.length, 0);
    expect(rows.length).toBe(goldenCount);
  });
});
