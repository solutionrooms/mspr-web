// m6 — prismatic + distance joints (mspr config).
//
// PRIS — mirrors harness-joints2: a box on a vertical prismatic given a sideways kick.
// The perp + angular constraints keep it on-axis and unrotated (angle locked at 0 =>
// trig-immune). PURE bit-exact gate over the prismatic linear/angular/perp constraints.
//
// DIST — a box held at fixed distance from a static anchor (rope), released to swing.
// The rope attaches at the box COM so there's no torque (angle stays 0 => trig-immune
// here too); gated bit-exact with the distance invariant.
//
// Config: mspr AABB ±25000, gravity (0,20), Step(1/80,10).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { b2World } from "../src/box2d/Dynamics/b2World";
import { b2AABB } from "../src/box2d/Collision/b2AABB";
import { b2Vec2 } from "../src/box2d/Common/Math/b2Vec2";
import { b2BodyDef } from "../src/box2d/Dynamics/b2BodyDef";
import { b2PolygonDef } from "../src/box2d/Collision/Shapes/b2PolygonDef";
import { b2PrismaticJointDef } from "../src/box2d/Dynamics/Joints/b2PrismaticJointDef";
import { b2DistanceJointDef } from "../src/box2d/Dynamics/Joints/b2DistanceJointDef";
import type { b2Body } from "../src/box2d/Dynamics/b2Body";
import { f64hex, norm, type Golden } from "./helpers/hex16";

const __dirname = dirname(fileURLToPath(import.meta.url));
const golden: Golden = JSON.parse(readFileSync(join(__dirname, "goldens", "m6-joints2.json"), "utf8"));

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
// mspr config (PhysicsBase.as): AABB ±25000, gravity (0,20).
function makeWorld(): b2World {
  const aabb = new b2AABB();
  aabb.lowerBound.Set(-25000, -25000);
  aabb.upperBound.Set(25000, 25000);
  const w = new b2World(aabb, new b2Vec2(0, 20), false);
  w.SetContinuousPhysics(false);
  return w;
}
function makeBox(w: b2World, x: number, y: number): b2Body {
  const bd = new b2BodyDef();
  bd.position.Set(x, y);
  const b = w.CreateBody(bd)!;
  const sd = new b2PolygonDef();
  sd.SetAsBox(0.3, 0.3);
  sd.density = 1;
  b.CreateShape(sd);
  b.SetMassFromShapes();
  return b;
}

describe("m6 — prismatic joint (bit-exact, mspr config)", () => {
  it("PRIS matches the golden every step (axis-locked => trig-immune)", () => {
    const w = makeWorld();
    const box = makeBox(w, 0, 1);
    box.SetLinearVelocity(new b2Vec2(2, 0));
    const jd = new b2PrismaticJointDef();
    jd.Initialize(w.GetGroundBody(), box, new b2Vec2(0, 0), new b2Vec2(0, 1));
    jd.collideConnected = false;
    w.CreateJoint(jd);

    const g = golden.golden.PRIS;
    const check = (i: number): void => {
      const got = fields(box);
      for (let f = 0; f < 6; f++) {
        expect(got[f], `PRIS step ${i} field ${f}: ours=${got[f]} golden=${norm(g[i].fields[f])}`).toBe(
          norm(g[i].fields[f]),
        );
      }
    };
    check(0);
    for (let i = 1; i <= 60; i++) {
      w.Step(1 / 80, 10);
      check(i);
    }
  });
});

describe("m6 — distance joint (bit-exact, mspr config)", () => {
  it("DIST matches the golden every step + holds the length-2 invariant", () => {
    const w = makeWorld();
    const box = makeBox(w, 2, 0);
    const jd = new b2DistanceJointDef();
    jd.Initialize(w.GetGroundBody(), box, new b2Vec2(0, 0), new b2Vec2(2, 0));
    jd.collideConnected = false;
    w.CreateJoint(jd);

    const g = golden.golden.DIST;
    const check = (i: number): void => {
      const got = fields(box);
      for (let f = 0; f < 6; f++) {
        expect(got[f], `DIST step ${i} field ${f}: ours=${got[f]} golden=${norm(g[i].fields[f])}`).toBe(
          norm(g[i].fields[f]),
        );
      }
      const d = Math.hypot(box.GetPosition().x, box.GetPosition().y);
      expect(Math.abs(d - 2), `DIST step ${i} rope length`).toBeLessThan(1e-3);
    };
    check(0);
    for (let i = 1; i <= 60; i++) {
      w.Step(1 / 80, 10);
      check(i);
    }
  });
});
