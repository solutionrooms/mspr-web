// m4 — the 2.0.x contact solver bit-exact gate (mspr config).
//
// Mirrors tools/oracle/harness-solver.as. The solver is ISOLATED: continuousPhysics OFF
// (TOI is m7), doSleep OFF (sleep is m5) — so this gates only the discrete sequential-
// impulse solver (normal + tangent/friction impulses, restitution, inline Baumgarte,
// warm-starting) across a real landing-and-sliding settle, under mspr's world config
// (AABB ±25000, gravity (0,20), Step(1/80, 10)).
//
// M4FIX — fixedRotation box (invI=0 => never rotates => trig-IMMUNE): PURE bit-exact,
//   every field every step. This is the m4 gate.
// M4ROT — same box free to rotate: the trig-ceiling MEASUREMENT (CLAUDE.md rule 5).
//   cos/sin enter once the box rotates during the asymmetric bounce; assert a bit-exact
//   PREFIX, then a bounded tolerance after (labelled — NOT called "exact").
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
const golden: Golden = JSON.parse(readFileSync(join(__dirname, "goldens", "m4-solver.json"), "utf8"));

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

// runs the harness scene (mspr config) and returns our per-step field rows
function runScene(fixedRotation: boolean): string[][] {
  const aabb = new b2AABB();
  aabb.lowerBound.Set(-25000, -25000);
  aabb.upperBound.Set(25000, 25000);
  const world = new b2World(aabb, new b2Vec2(0, 20), false);
  world.SetContinuousPhysics(false);

  const gd = new b2BodyDef();
  gd.position.Set(0, 5);
  const ground = world.CreateBody(gd)!;
  const gs = new b2PolygonDef();
  gs.SetAsBox(5, 0.5);
  gs.friction = 0.5;
  gs.restitution = 0.1;
  ground.CreateShape(gs);

  const dd = new b2BodyDef();
  dd.position.Set(0, 2);
  dd.fixedRotation = fixedRotation;
  const box = world.CreateBody(dd)!;
  const ds = new b2PolygonDef();
  ds.SetAsBox(0.5, 0.5);
  ds.density = 0.5;
  ds.friction = 0.3;
  ds.restitution = 0.2;
  box.CreateShape(ds);
  box.SetMassFromShapes();
  box.SetLinearVelocity(new b2Vec2(2, 0));

  const rows: string[][] = [fields(box)];
  for (let i = 1; i <= 150; i++) {
    world.Step(1 / 80, 10);
    rows.push(fields(box));
  }
  return rows;
}

describe("m4 — contact solver (fixedRotation, bit-exact, mspr config)", () => {
  it("M4FIX matches the Ruffle golden every field every step", () => {
    const rows = runScene(true);
    const g = golden.golden.M4FIX;
    for (let i = 0; i <= 150; i++) {
      for (let f = 0; f < 6; f++) {
        expect(rows[i][f], `M4FIX step ${i} field ${f}: ours=${rows[i][f]} golden=${norm(g[i].fields[f])}`).toBe(
          norm(g[i].fields[f]),
        );
      }
    }
  });
});

describe("m4 — rotating-box landing (trig-ceiling MEASUREMENT, exact-prefix + tolerance)", () => {
  it("M4ROT is bit-exact for a real prefix, then within a tight bound (NOT labelled exact)", () => {
    const rows = runScene(false);
    const g = golden.golden.M4ROT;
    let firstDiverge = 151;
    for (let i = 0; i <= 150; i++) {
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
    // The pre-contact ballistic + initial-contact phase must be bit-exact (trig only
    // enters once the box rotates during the bounce). Under mspr config (gravity 20,
    // Step 1/80) the box lands ~step 36, so the exact prefix is shorter than FZ3's.
    console.log(`[m4 trig measure] M4ROT bit-exact through step ${firstDiverge - 1}; trig diverges at step ${firstDiverge}`);
    expect(firstDiverge, "M4ROT should be bit-exact at least through the pre-bounce ballistic phase").toBeGreaterThanOrEqual(30);
    // After divergence, the trajectory must stay within a tight tolerance (V8 vs Ruffle
    // libm sin/cos ≤1 ULP, amplified through the settle) — behavioural, labelled.
    for (let i = firstDiverge; i <= 150; i++) {
      for (let f = 0; f < 6; f++) {
        const ours = decode(rows[i][f]);
        const want = decode(norm(g[i].fields[f]));
        expect(Math.abs(ours - want), `M4ROT step ${i} field ${f} tolerance`).toBeLessThan(1e-6);
      }
    }
  });
});
