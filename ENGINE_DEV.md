# ENGINE_DEV — brief for the Box2D engine developer (mspr)

You own the **bit-exact Box2DFlash 2.0.2 → TypeScript** port and its golden tests. Read
`CLAUDE.md` (the Prime Directive + the four faithfulness places) first. This brief is the
mspr-specific delta on top of FZ3's engine work.

## The headline: the engine is already ported once, and the source is identical
mspr's `extracted/scripts/Box2D/` is **byte-for-byte identical** to FZ3's (all 74 files,
verified by aggregate MD5). **FZ3's `src/box2d/` TypeScript port applies to mspr verbatim.**
You are not re-porting the engine — you are (a) deciding how to share it with FZ3, and
(b) finishing the milestones FZ3 hasn't, which mspr needs.

### FIRST TASK — settle the shared-engine question (post to DEVELOPER_MESSAGES `To: game`)
Box2D is identical source in both repos. Forking it means fixing every solver/TOI/sleep
bug twice and risking the two copies drifting (fatal for a bit-exact engine). Options:
- **(Recommended) Co-develop once**, consume from both. e.g. a shared `box2d` package /
  path both repos import, or develop in FZ3 and vendor a pinned copy into mspr with a
  sync script + a hash check in CI that fails if they diverge.
- **Fork** `src/box2d/` into mspr now and accept divergence risk.
Bring a recommendation; **game** will ratify. Until then, you may lift FZ3's current
`src/box2d/` into `src/box2d/` to get m0/m1 green locally.

## mspr constants — copy these, NEVER FZ3's (they all differ)
From `PhysicsBase.as`: `physStep = 1/80`, `physNumIterations = 10`, `p2w = 20`
(`w2p = 0.05`), world AABB `±25000`, gravity `400` → `physGravity = 20`. Step cadence is
**2× back-to-back `Step(1/80, 10)` per gameplay update** (`Game.as`,
`UpdateGameplay_*` / in-race). The integrator math is identical to FZ3; only the
configuration differs. The freefall harness (`tools/oracle/harness-freefall.as`) already
encodes mspr's world config.

## Milestone state to finish (mspr needs all of these; shared benefit with FZ3)
FZ3 has m0/m1 (freefall) green, m2 (collision narrowphase) in progress. **Not started:**
- **m2** narrowphase: `b2Collision`, `b2Manifold(Point)`, `b2Distance`, the concrete
  contacts (`b2CircleContact`, `b2PolygonContact`, `b2PolyAndCircleContact`), `ClipVertex`.
- **m4** solver: `b2ContactSolver` (all 5 phases) — 2.0.x inline Baumgarte.
- **m6** joints: **all of these, mspr uses them** — revolute, prismatic, pulley, distance,
  mouse (+ `b2Jacobian`, defs). Car assemblies are jointed (chassis + wheels) → also
  finish `b2Body::ShouldCollide`/`collideConnected` (faithfulness place #3).
- **m7** CCD/TOI: `b2TimeOfImpact` + `b2World::SolveTOI` + sub-step solve (the hardest;
  budget most time; goldens for fast-car shots — dump the `b2Sweep` `c,a,c0,a0`).
- Audit **every** velocity/transform mutator for `WakeUp()` + `m_sleepTime` reset (place #4).

## The golden-trace rig (already scaffolded, targets `Preloader`)
```
npm install
npm run oracle:build:freefall      # ffdec -replace mspaintracer.swf … Preloader harness-freefall.as
npm run oracle:capture:freefall    # Ruffle headless → test/goldens/m0-m1-freefall.json
npm run test                       # vitest hex16 gate
```
Add a milestone = add `harness-<m>.as` (document class `Preloader`, deterministic scene, trace
`[TAG] step hex16…`, end `[DONE]`), a `data/goldens/<m>.json` capture, and a vitest gate.
Per-step fields: `GetPosition().x/.y`, `GetAngle()`, `GetLinearVelocity().x/.y`,
`GetAngularVelocity()` — for TOI shots also dump the `b2Sweep`. **No milestone is "done"
until its hex16 gate is green.** Run captures long enough for a body to actually SLEEP.

## mspr-specific physics layer (port fresh — FZ3 has close TS templates)
Outside `Box2D/`, port these (only `PhysicsBase` calls Box2D):
- `PhysicsBase.as` (397 LOC) — the world factory + `AddPhysObjAt` (body/shape/joint
  creation from physobj defs). Differs from FZ3's by ~52 lines; FZ3's
  `src/game/model/phys-obj-*.ts` are close references.
- `PhysObj`/`PhysLine`/`Collision`/`PhysObj_*UserData` — pure data/geometry, no `b2*`.
- `CarCollision.as` (440 LOC) — the game's OWN arcade car-vs-car layer (operates on
  `GameObj`s, not bodies) — port with the game framework, not the engine, but be aware it
  layers on top of the sim.

Coordinate with **game** (consumes `data/physobjs.json` + `data/materials.json` via the
loader) and keep the engine a pure-math module with ZERO game/render/Flash deps.
