// m3b — contact lifecycle bit-exact gate (mspr config).
//
// Mirrors tools/oracle/harness-contact.as: a STATIC ground shape + a DYNAMIC shape
// overlapping, built via the faithful game flow (CreateBody mass-0 -> CreateShape ->
// SetMassFromShapes flips static->dynamic -> RefilterProxy re-fires PairAdded as a REAL
// contact), then m_contactManager.Collide() evaluates it (Update -> Evaluate -> collide).
// Axis-aligned (angle-0) => trig-free => bit-exact. Asserts hex16 for contactCount,
// friction (= sqrt(f1*f2)), restitution (= max), manifoldCount, and the manifold.
// Exercises b2Contact registry/Create, the 3 contact subclasses, b2ContactManager
// PairAdded/PairRemoved + RefilterProxy round-trip — the VENDORED m2 contact pipeline.
//
// CONFIG: mspr world AABB ±25000 / gravity (0,20) (PhysicsBase.as). No Step → solver
// untouched; this gate is solver-independent and runs on the current vendored engine.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { b2World } from "../src/box2d/Dynamics/b2World";
import { b2AABB } from "../src/box2d/Collision/b2AABB";
import { b2Vec2 } from "../src/box2d/Common/Math/b2Vec2";
import { b2BodyDef } from "../src/box2d/Dynamics/b2BodyDef";
import { b2PolygonDef } from "../src/box2d/Collision/Shapes/b2PolygonDef";
import { b2CircleDef } from "../src/box2d/Collision/Shapes/b2CircleDef";
import { f64hex, norm, type Golden } from "./helpers/hex16";

const __dirname = dirname(fileURLToPath(import.meta.url));
const golden: Golden = JSON.parse(readFileSync(join(__dirname, "goldens", "m3b-contact.json"), "utf8"));

type Row = { tag: string; step: number; fields: string[] };
const rows: Row[] = [];
function emit(tag: string, step: number, values: number[]): void {
  rows.push({ tag, step, fields: values.map(f64hex) });
}
// mspr config (PhysicsBase.as): AABB ±25000, gravity (0,20).
function makeWorld(): b2World {
  const aabb = new b2AABB();
  aabb.lowerBound.Set(-25000, -25000);
  aabb.upperBound.Set(25000, 25000);
  return new b2World(aabb, new b2Vec2(0, 20), true);
}
function dumpContact(tag: string, world: b2World): void {
  const c = world.m_contactList!;
  emit(tag, 0, [world.m_contactCount, c.m_friction, c.m_restitution, c.m_manifoldCount]);
  const m = c.GetManifolds()![0];
  emit(tag + "N", 0, [m.pointCount, m.normal.x, m.normal.y]);
  for (let i = 0; i < m.pointCount; i++) {
    const p = m.points[i];
    emit(tag + "P", i, [p.separation, p.localPoint1.x, p.localPoint1.y, p.localPoint2.x, p.localPoint2.y, p.id._key]);
  }
}

function scenePolyPoly(): void {
  const w = makeWorld();
  const gd = new b2BodyDef();
  gd.position.Set(0, 2);
  const ground = w.CreateBody(gd)!;
  const gs = new b2PolygonDef();
  gs.SetAsBox(3, 0.5);
  gs.friction = 0.5;
  gs.restitution = 0.1;
  ground.CreateShape(gs);

  const dd = new b2BodyDef();
  dd.position.Set(0.3, 1.2);
  const dyn = w.CreateBody(dd)!;
  const ds = new b2PolygonDef();
  ds.SetAsBox(0.5, 0.5);
  ds.density = 0.5;
  ds.friction = 0.3;
  ds.restitution = 0.2;
  dyn.CreateShape(ds);
  dyn.SetMassFromShapes();

  w.m_contactManager.Collide();
  dumpContact("PP", w);
}

function scenePolyCircle(): void {
  const w = makeWorld();
  const gd = new b2BodyDef();
  gd.position.Set(0, 2);
  const ground = w.CreateBody(gd)!;
  const gs = new b2PolygonDef();
  gs.SetAsBox(3, 0.5);
  gs.friction = 0.4;
  gs.restitution = 0.3;
  ground.CreateShape(gs);

  const dd = new b2BodyDef();
  dd.position.Set(0.2, 1.2);
  const dyn = w.CreateBody(dd)!;
  const ds = new b2CircleDef();
  ds.radius = 0.5;
  ds.density = 0.5;
  ds.friction = 0.6;
  ds.restitution = 0.1;
  dyn.CreateShape(ds);
  dyn.SetMassFromShapes();

  w.m_contactManager.Collide();
  dumpContact("PC", w);
}

function sceneCircleCircle(): void {
  const w = makeWorld();
  const gd = new b2BodyDef();
  gd.position.Set(0, 2);
  const ground = w.CreateBody(gd)!;
  const gs = new b2CircleDef();
  gs.radius = 0.7;
  gs.friction = 0.5;
  gs.restitution = 0.4;
  ground.CreateShape(gs);

  const dd = new b2BodyDef();
  dd.position.Set(0.9, 1.6);
  const dyn = w.CreateBody(dd)!;
  const ds = new b2CircleDef();
  ds.radius = 0.6;
  ds.density = 0.5;
  ds.friction = 0.5;
  ds.restitution = 0.6;
  dyn.CreateShape(ds);
  dyn.SetMassFromShapes();

  w.m_contactManager.Collide();
  dumpContact("CC", w);
}

describe("m3b — contact lifecycle (bit-exact, mspr config)", () => {
  it("matches the Ruffle golden for contact creation + manifold evaluation", () => {
    rows.length = 0;
    scenePolyPoly();
    scenePolyCircle();
    sceneCircleCircle();
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
