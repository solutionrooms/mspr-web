// m6 — revolute joint gate (mspr config).
//
// REV — mirrors tools/oracle/harness-revolute.as: a horizontal bar pinned at its left
// end to the static groundBody by a revolute, swinging down under gravity (pendulum).
// The bar ROTATES so this is trig-exposed — assert a bit-exact PREFIX then a bounded
// tolerance (rule 5; NOT labelled exact). Also confirms the constraint holds: COM stays
// 1.0 from the pivot.
//
// REVCC — the collideConnected/ShouldCollide hotspot (CLAUDE.md hotspot #3): two FULLY
// OVERLAPPING bodies joined by a revolute with collideConnected=false must NOT generate
// an internal contact (else a deep-penetration contact pins the assembly — the classic
// "contraption won't move from rest" fake-friction bug). mspr's CARS are jointed chassis+
// wheels that overlap, so this is the gate that keeps them from pinning. Assert
// m_contactCount === 0. (Config: mspr AABB ±25000, gravity (0,20), Step(1/80,10).)
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { b2World } from "../src/box2d/Dynamics/b2World";
import { b2AABB } from "../src/box2d/Collision/b2AABB";
import { b2Vec2 } from "../src/box2d/Common/Math/b2Vec2";
import { b2BodyDef } from "../src/box2d/Dynamics/b2BodyDef";
import { b2PolygonDef } from "../src/box2d/Collision/Shapes/b2PolygonDef";
import { b2RevoluteJointDef } from "../src/box2d/Dynamics/Joints/b2RevoluteJointDef";
import type { b2Body } from "../src/box2d/Dynamics/b2Body";
import { f64hex, norm, type Golden } from "./helpers/hex16";

const __dirname = dirname(fileURLToPath(import.meta.url));
const golden: Golden = JSON.parse(readFileSync(join(__dirname, "goldens", "m6-revolute.json"), "utf8"));

function fields(b: b2Body): string[] {
  return [
    f64hex(b.GetPosition().x),
    f64hex(b.GetPosition().y),
    f64hex(b.GetAngle()),
    f64hex(b.GetLinearVelocity().x),
    f64hex(b.GetLinearVelocity().y),
    f64hex(b.GetAngularVelocity()),
  ];
}
function decode(hex: string): number {
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setUint32(0, parseInt(hex.slice(0, 8), 16), false);
  dv.setUint32(4, parseInt(hex.slice(8), 16), false);
  return dv.getFloat64(0, false);
}

describe("m6 — revolute joint (pendulum, trig-measured, mspr config)", () => {
  it("REV matches the golden for a bit-exact prefix, then within a tight bound", () => {
    const aabb = new b2AABB();
    aabb.lowerBound.Set(-25000, -25000);
    aabb.upperBound.Set(25000, 25000);
    const world = new b2World(aabb, new b2Vec2(0, 20), false);

    const bd = new b2BodyDef();
    bd.position.Set(1, 0);
    const bar = world.CreateBody(bd)!;
    const sd = new b2PolygonDef();
    sd.SetAsBox(1, 0.2);
    sd.density = 1;
    sd.friction = 0.3;
    sd.restitution = 0;
    bar.CreateShape(sd);
    bar.SetMassFromShapes();

    const jd = new b2RevoluteJointDef();
    jd.Initialize(world.GetGroundBody(), bar, new b2Vec2(0, 0));
    jd.collideConnected = false;
    world.CreateJoint(jd);

    const rows: string[][] = [fields(bar)];
    for (let i = 1; i <= 60; i++) {
      world.Step(1 / 80, 10);
      rows.push(fields(bar));
    }

    const g = golden.golden.REV;
    let firstDiverge = 61;
    for (let i = 0; i <= 60; i++) {
      let diff = false;
      for (let f = 0; f < 6; f++) {
        if (rows[i][f] !== norm(g[i].fields[f])) {
          diff = true;
          break;
        }
      }
      if (diff) {
        firstDiverge = i;
        break;
      }
    }
    console.log(`[m6 trig measure] REV bit-exact through step ${firstDiverge - 1}; diverges at step ${firstDiverge}`);
    // The bar starts axis-aligned; trig only accumulates as it rotates. Require a real
    // exact prefix (the early swing before cos/sin feedback diverges V8 vs Ruffle).
    expect(firstDiverge, "REV should be bit-exact at least through the early swing").toBeGreaterThanOrEqual(8);
    // After divergence, stay within a tight tolerance (V8 vs Ruffle sin/cos ≤1 ULP).
    for (let i = firstDiverge; i <= 60; i++) {
      for (let f = 0; f < 6; f++) {
        expect(Math.abs(decode(rows[i][f]) - decode(norm(g[i].fields[f]))), `REV step ${i} field ${f} tol`).toBeLessThan(
          1e-6,
        );
      }
      // and the revolute constraint must keep the COM ~1.0 from the pivot
      const d = Math.hypot(decode(rows[i][0]), decode(rows[i][1]));
      expect(Math.abs(d - 1), `REV step ${i} pivot distance`).toBeLessThan(1e-3);
    }
  });
});

describe("m6 — collideConnected hotspot (overlapping jointed bodies move freely, mspr config)", () => {
  it("REVCC: two overlapping bodies joined with collideConnected=false generate NO internal contact", () => {
    const aabb = new b2AABB();
    aabb.lowerBound.Set(-25000, -25000);
    aabb.upperBound.Set(25000, 25000);
    const world = new b2World(aabb, new b2Vec2(0, 20), false);

    const mk = (): b2Body => {
      const bd = new b2BodyDef();
      bd.position.Set(0, 0);
      const b = world.CreateBody(bd)!;
      const sd = new b2PolygonDef();
      sd.SetAsBox(0.5, 0.5);
      sd.density = 1;
      b.CreateShape(sd);
      b.SetMassFromShapes();
      return b;
    };
    const a = mk();
    const b = mk();

    const jd = new b2RevoluteJointDef();
    jd.Initialize(a, b, new b2Vec2(0, 0));
    jd.collideConnected = false;
    world.CreateJoint(jd);

    // After CreateJoint's RefilterProxy, the jointed (collideConnected=false) overlapping
    // pair must be a nullContact — no real internal contact pinning the assembly.
    expect(world.m_contactCount, "no internal contact for collideConnected=false jointed pair").toBe(0);
    const y0 = b.GetPosition().y;
    for (let i = 0; i < 20; i++) {
      world.Step(1 / 80, 10);
    }
    expect(world.m_contactCount, "still no internal contact after stepping").toBe(0);
    expect(b.GetPosition().y, "assembly falls freely (not pinned)").toBeGreaterThan(y0 + 0.05);
  });
});
