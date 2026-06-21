// m7 — CCD/TOI bit-exact gate (the hardest hotspot), mspr config.
//
// Mirrors tools/oracle/harness-toi.as. continuousPhysics ON: a fast bullet (360 u/s ⇒
// 4.5 u/step at 1/80) that WITHOUT TOI would tunnel clean through a thin static wall is
// caught at the wall by b2World.SolveTOI → b2TimeOfImpact (conservative advancement over
// GJK b2Distance) → b2Island.SolveTOI sub-step. Validates the ENTIRE TOI stack — the
// surface mspr's fast cars / missiles hit. Config: mspr AABB ±25000, Step(1/80,10);
// gravity (0,0) is a scene choice (isolate TOI), kept from FZ3.
//
// M7FIX — fixedRotation bullet, head-on (invI=0 ⇒ angle stays 0 ⇒ sub-step GetXForm uses
//   cos0/sin0 ⇒ trig-immune): PURE bit-exact gate.
// M7ROT — free bullet hitting OFF-centre (rotates ⇒ the TOI sub-step trig surface):
//   MEASURE the bit-exact prefix, then a bounded tolerance (rule 5; NOT labelled exact).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { b2World } from "../src/box2d/Dynamics/b2World";
import { b2AABB } from "../src/box2d/Collision/b2AABB";
import { b2Vec2 } from "../src/box2d/Common/Math/b2Vec2";
import { b2BodyDef } from "../src/box2d/Dynamics/b2BodyDef";
import { b2PolygonDef } from "../src/box2d/Collision/Shapes/b2PolygonDef";
import type { b2Body } from "../src/box2d/Dynamics/b2Body";
import { f64hex, norm, type Golden } from "./helpers/hex16";

const __dirname = dirname(fileURLToPath(import.meta.url));
const golden: Golden = JSON.parse(readFileSync(join(__dirname, "goldens", "m7-toi.json"), "utf8"));

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

function runScene(fixedRotation: boolean, yOffset: number): string[][] {
  const aabb = new b2AABB();
  aabb.lowerBound.Set(-25000, -25000);
  aabb.upperBound.Set(25000, 25000);
  const world = new b2World(aabb, new b2Vec2(0, 0), false);

  const wd = new b2BodyDef();
  wd.position.Set(4, 0);
  const wall = world.CreateBody(wd)!;
  const ws = new b2PolygonDef();
  ws.SetAsBox(0.15, 4);
  ws.friction = 0.3;
  ws.restitution = 0;
  wall.CreateShape(ws);

  const bd = new b2BodyDef();
  bd.position.Set(0, yOffset);
  bd.fixedRotation = fixedRotation;
  const bullet = world.CreateBody(bd)!;
  const bs = new b2PolygonDef();
  bs.SetAsBox(0.2, 0.2);
  bs.density = 1;
  bs.friction = 0.3;
  bs.restitution = 0;
  bullet.CreateShape(bs);
  bullet.SetMassFromShapes();
  bullet.SetBullet(true);
  bullet.SetLinearVelocity(new b2Vec2(360, 0));

  const rows: string[][] = [fields(bullet)];
  for (let i = 1; i <= 30; i++) {
    world.Step(1 / 80, 10);
    rows.push(fields(bullet));
  }
  return rows;
}

describe("m7 — CCD/TOI (fixedRotation bullet, bit-exact, mspr config)", () => {
  it("M7FIX: a fast bullet is caught at the thin wall (no tunneling) — bit-exact every step", () => {
    const rows = runScene(true, 0);
    const g = golden.golden.M7FIX;
    // sanity: TOI actually fired (bullet caught at the wall ~3.65, not tunneled past)
    expect(decode(rows[30][0]), "bullet must rest at the wall (~3.65), not tunnel past").toBeLessThan(3.9);
    for (let i = 0; i <= 30; i++) {
      for (let f = 0; f < 6; f++) {
        expect(rows[i][f], `M7FIX step ${i} field ${f}: ours=${rows[i][f]} golden=${norm(g[i].fields[f])}`).toBe(
          norm(g[i].fields[f]),
        );
      }
    }
  });
});

describe("m7 — off-centre bullet (TOI trig-ceiling MEASUREMENT, exact-prefix + tolerance, mspr config)", () => {
  it("M7ROT: bit-exact through the impact, then within a tight bound (NOT labelled exact)", () => {
    const rows = runScene(false, 0.18);
    const g = golden.golden.M7ROT;
    let firstDiverge = 31;
    for (let i = 0; i <= 30; i++) {
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
    console.log(`[m7 trig measure] M7ROT bit-exact through step ${firstDiverge - 1}; trig diverges at step ${firstDiverge}`);
    // The pre-impact ballistic flight must be bit-exact (trig only enters once the TOI
    // sub-step rotates the bullet on the off-centre hit).
    expect(firstDiverge, "M7ROT should be bit-exact at least through the pre-impact flight").toBeGreaterThanOrEqual(2);
    for (let i = firstDiverge; i <= 30; i++) {
      for (let f = 0; f < 6; f++) {
        expect(Math.abs(decode(rows[i][f]) - decode(norm(g[i].fields[f]))), `M7ROT step ${i} field ${f} tol`).toBeLessThan(
          1e-6,
        );
      }
    }
  });
});
