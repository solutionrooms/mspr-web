// m5 — sleep / wake bit-exact gate (mspr config).
//
// Mirrors tools/oracle/harness-sleep.as. doSleep ON (the new thing), continuousPhysics
// OFF (TOI=m7). A fixedRotation box (trig-immune) lands, slides to rest, and SLEEPS once
// still ≥ b2_timeToSleep — then stays frozen (the island skips sleeping bodies) until an
// ApplyImpulse WAKES it at step 110. The 7th traced field is isSleeping(0/1), so the exact
// sleep-transition step and the velocity-zeroing at sleep are gated bit-for-bit — this is
// faithfulness place #4 (CLAUDE.md), the #1 "works in isolation, fails in game" source
// (SB2's stack-settle diverged exactly at the frame allowSleep zeroed a ~1e-15 residual).
//
// Under mspr config (g20 / Step 1/80) the box sleeps at step 93 (vs FZ3's ~step 36×1/60);
// wake at 110 is comfortably after. Also asserts the faithful 2.0.x wake semantics in a
// sub-test: Apply* wakes a sleeping body, SetLinearVelocity does NOT (the silent-kick trap).
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
const golden: Golden = JSON.parse(readFileSync(join(__dirname, "goldens", "m5-sleep.json"), "utf8"));

function fields(b: b2Body): string[] {
  return [
    f64hex(b.GetPosition().x),
    f64hex(b.GetPosition().y),
    f64hex(b.GetAngle()),
    f64hex(b.GetLinearVelocity().x),
    f64hex(b.GetLinearVelocity().y),
    f64hex(b.GetAngularVelocity()),
    f64hex(b.IsSleeping() ? 1 : 0),
  ];
}

// mspr config (PhysicsBase.as): AABB ±25000, gravity (0,20), doSleep ON.
function buildScene(): { world: b2World; box: b2Body } {
  const aabb = new b2AABB();
  aabb.lowerBound.Set(-25000, -25000);
  aabb.upperBound.Set(25000, 25000);
  const world = new b2World(aabb, new b2Vec2(0, 20), true);
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
  dd.fixedRotation = true;
  const box = world.CreateBody(dd)!;
  const ds = new b2PolygonDef();
  ds.SetAsBox(0.5, 0.5);
  ds.density = 0.5;
  ds.friction = 0.3;
  ds.restitution = 0.2;
  box.CreateShape(ds);
  box.SetMassFromShapes();
  box.SetLinearVelocity(new b2Vec2(2, 0));
  return { world, box };
}

describe("m5 — sleep/wake (bit-exact, mspr config)", () => {
  it("matches the Ruffle golden incl. the exact sleep-transition step and wake-on-impulse", () => {
    const { world, box } = buildScene();
    const g = golden.golden.M5;
    const check = (i: number): void => {
      const got = fields(box);
      for (let f = 0; f < 7; f++) {
        expect(got[f], `M5 step ${i} field ${f}: ours=${got[f]} golden=${norm(g[i].fields[f])}`).toBe(
          norm(g[i].fields[f]),
        );
      }
    };
    check(0);
    for (let i = 1; i <= 160; i++) {
      if (i === 110) {
        box.ApplyImpulse(new b2Vec2(2, -3), box.GetWorldCenter());
      }
      world.Step(1 / 80, 10);
      check(i);
    }
    // sanity: the golden actually exercised a real sleep then wake
    const sleepFlags = g.map((r) => Number(norm(r.fields[6]) === f64hex(1)));
    expect(sleepFlags.includes(1), "golden must contain a sleep").toBe(true);
    expect(sleepFlags[160], "box must be awake again at the end").toBe(0);
  });

  it("faithful 2.0.x wake trap: ApplyImpulse wakes a sleeping body, SetLinearVelocity does NOT", () => {
    const { world, box } = buildScene();
    // mspr sleeps at step 93; step to 105 (asleep, before the 110 impulse).
    for (let i = 1; i <= 105; i++) {
      world.Step(1 / 80, 10);
    }
    expect(box.IsSleeping(), "box should be asleep by step 105").toBe(true);
    // SetLinearVelocity must NOT wake (the silently-discarded-kick trap)
    box.SetLinearVelocity(new b2Vec2(5, 0));
    expect(box.IsSleeping(), "SetLinearVelocity must not wake").toBe(true);
    // ApplyImpulse MUST wake
    box.ApplyImpulse(new b2Vec2(1, -1), box.GetWorldCenter());
    expect(box.IsSleeping(), "ApplyImpulse must wake").toBe(false);
  });
});
