# ENGINE_DEV — brief for the engine developer (mspr)

> **⚠ PIVOT 2026-06-21 — your target changed from Box2D to the ARCADE car engine.**
> See `CLAUDE.md` (Prime Directive banner) + DEVELOPER_MESSAGES "Box2D is dead in the ship".
> Static proof from the shipped bytecode: `b2World.Step` is called only in `UpdateGameplay_Garage`
> (Game.as:2232-2233), which has **zero callers**; the shipped tick `Main.RunLevel →
> Game.UpdateGameplay` (race loop, Game.as:1998) **never steps Box2D**; and no shipped physobj def
> even creates a body. **Box2D is vestigial.** mspr's gameplay — and everything ghosts/best-times
> depend on — is a **pure arcade pseudo-3D integrator**. That is now your bit-exact mandate.

You own the **bit-exact arcade car engine → TypeScript** port and its golden tests. Same
methodology as before (oracle = truth, preserve op-order, hex16 gate, milestone-gated, never tune),
new target. Read `CLAUDE.md` first (Prime Directive + the four faithfulness places, both retargeted).

## What you port (all pure `Number` math — bit-identical by faithful op-order)
1. **`GameObj.UpdatePlayer`** (GameObj.as:1994) — the player car integrator: a `state` machine
   (99/98 race-start, 90/100 crossed-line, 80 explode, 70 spin, 0 normal driving) that integrates
   `zpos += zvel (+ turboVel)`, lateral `xpos`, height `ypos/yvel` (jumps), reads input via
   `KeyReader.Down/Pressed`, and is **data-driven** through `Vars.GetVarAsNumber(...)`. Plus the
   sibling states/helpers: `UpdatePlayer_RaceStart*`, `UpdatePlayer_CrossedLine*`, `UpdatePlayerSpin`,
   `UpdatePlayerExplode`, `UpdateCarYvel`, `UpdatePlayerCollideForces`, `CheckLap`, drafting.
2. **`UpdateAICar*`** — the AI racers (same track-space model; `UpdateAICarYvel` etc.).
3. **`CarCollision.as`** (440 LOC) — car↔car push-apart + overtake, in track-space
   (`xpos/zpos/collisionDX/collisionDZ`, `oldxpos/oldzpos`). Iteration- and list-order-dependent.
4. **`Collision.as`** — car↔track-edge/wall + missile/projectile response (also arcade).

**hex16 gate:** the car state `(xpos, ypos, zpos, xvel, yvel, zvel, dir, turboVel)` per
`UpdateGameplay`. No tolerance gate labelled "exact". The only physical exception is the trig ceiling
(`sin/cos/atan2` in steering/heading/camera/drafting) — strict escalation, never a blanket epsilon.

## The new golden ladder (a0…a7) — milestone-gated, each lands with its golden
- **a0 — coast (your first task; the "freefall" of this engine).** Smallest self-contained path:
  the `isKnockedOut` branch (GameObj.as:2059-2069) is ideal — `zpos += zvel; zvel -= 0.1; if(zvel<0)
  zvel=0` — a decelerating roll with a clamp, almost no deps. Trace `zpos/zvel` until it settles at 0.
  (Alt: the rolling-start path 2038-2049, a constant-`zvel` coast from `Vars.rollingStartZvel`.)
- **a1 — throttle / brake.** Scripted accel/decel input → `zvel/zpos` (normal-driving path).
- **a2 — steering.** LEFT/RIGHT → `xpos` + heading/`dir` + car frame. First real trig surface — measure
  the ceiling early (FZ3 rule 5).
- **a3 — jump / height.** `Car_StartJump`/`UpdateCarYvel`: `yvel += gravity_GO; ypos += yvel; …`.
- **a4 — car↔car.** Two cars → `CarCollision.CarCarCollision` push-apart. **Your hardest part**
  (the arcade analog of FZ3's TOI re-solve; the order is load-bearing).
- **a5 — track-edge / wall.** `Collision.as` boundary response.
- **a6 — laps / checkpoints / best-time.** `CheckLap`, `Game_AmericanRacer.CalculateRacePositions`,
  the medal gate.
- **a7 — ghost record + replay.** `GhostRecordingItem` capture then replay — must line up bit-for-bit
  over a full run. **Capture long (multi-lap)**: accumulated drift only shows over time.

## The golden-trace rig — same Preloader injection, new harness content
The capture infra is engine-agnostic and already works (you built the freefall one). For a0+, the
harness spawns a **player car** and traces *arcade* state instead of `world.Step`:
```
harness-a0-coast.as   (document class Preloader)
  - Game.InitData / Vars load (the car update reads Vars.GetVarAsNumber — load the embedded vars)
  - spawn a player GameObj, put it in the coast state (isKnockedOut), set zvel
  - for i in 0..N:  UpdatePlayer();  trace("[A0] " + i + " " + bits(go.zpos) + " " + bits(go.zvel))
  - trace("[DONE]")
```
Then `build-harness.mjs` / `capture-lines.mjs` as today → `test/goldens/a0-coast.json` → vitest hex16.
Open question for you (you built the freefall harness): do you want to own the a0 harness end-to-end,
or should I (game) stand up the minimal `Game`/`Vars` bootstrap it needs and hand you the trace seam?
Reply on the channel.

## The four faithfulness places (retargeted — see CLAUDE.md for the full text)
1. **Arcade collision re-solve order** (`CarCollision`/`Collision`) — your hardest part.
2. **Race order + `UpdatePlayer` state machine** (`Game.UpdateGameplay`, Game.as:1998) — load-bearing.
3. **`Vars` numeric semantics** — constants live in `data/vars.json`, read via `Vars.GetVarAsNumber`;
   a wrong `Number()` coercion drifts every car. (game owns the `Vars` loader — coordinate.)
4. **Input / ghost-replay determinism** — long goldens to expose drift.

## The game/engine seam (proposed — confirm on the channel)
- **You (engine):** the bit-exact integrator + `CarCollision` + `Collision`, golden-gated a0…a7. Pure
  module: takes a car's state + control input + `Vars`, advances it. ZERO render/Flash deps.
- **Me (game):** car spawning / level-load / control-input sampling (`KeyReader` → control flags) /
  camera wiring / the per-frame race order. `Game.updateGameplay` already models the race order and
  calls a `carCollision()` seam (stub) + the follow camera. `GameObj` already carries the arcade state
  fields (`xvel/yvel/zvel/oldxpos/oldzpos/turboVel`).

## Box2D — maintenance only (NOT on mspr's critical path)
Keep the vendored `src/box2d/` sync + hash-guard (`tools/sync-box2d.mjs`,
`test/box2d-sync.test.ts`) green for **FZ3 parity + the live demo**. mspr no longer blocks on FZ3's
m4/m6/m7. The guard currently *warns* "FZ3 advanced (de6ce53→9c65c8f)" — pull whenever; it's a warn,
not a fail, and not urgent. `PhysicsBase.as` / the freefall harness stay as the Box2D-demo path only.
