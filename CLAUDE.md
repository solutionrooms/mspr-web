# mspr — MS Paint Racers → TypeScript port

Sibling project to **FZ3** (`/Users/jonscott/Projects/FZ3`), same studio lineage, same
methodology. We are porting the same way: a bit-exact physics engine proven against a
golden-trace oracle, a faithful game-framework port, and a renderer chosen for fidelity.
Read FZ3's `CLAUDE.md` for the long-form rationale — this file states what's the **same**
and what's **different** for mspr, and the differences are load-bearing.

## ⛔ THE PRIME DIRECTIVE: bit-faithful physics, proven mechanically

> **⚠ TARGET CORRECTED 2026-06-21 — the bit-exact surface is the ARCADE car engine, NOT Box2D.**
> Static proof from the shipped bytecode: `b2World.Step` is called in exactly two lines
> (`Game.as:2232-2233`), both inside `UpdateGameplay_Garage`, which has **zero callers**; the
> shipped tick is `Main.RunLevel → Game.UpdateGameplay` (the race loop, `Game.as:1998`), which
> **never steps the world**. The only body-creator (`PhysicsBase.AddPhysObjAt`) is reachable only
> for physobj defs with *bodies but no graphics*, and the shipped `physobjs.json` has **none**.
> So Box2D is **vestigial FZ3 lineage, disabled in the ship** — created-never-stepped, like the
> dead `s3d.as` renderer. Cars/AI/missiles are **pure arcade** (`GameObj.UpdatePlayer` integrates
> `zpos += zvel` in track-space; `CarCollision`/`Collision` resolve in `xpos/zpos`). See
> DEVELOPER_MESSAGES "Box2D is dead in the ship".

**The arcade physics engine must reproduce the original's IEEE-754 output bit-for-bit** —
`hex16(ours) === hex16(original)` for every car's `(xpos, ypos, zpos, xvel, yvel, zvel, dir, turboVel)`
on **every** gameplay update. Tolerance comparisons (`abs(a−b) < ε`) are **banned** as the primary
correctness gate. Two bars (per FZ3/SB2 experience):
- **Engine (arcade car math): bit-exact.** Everything that *can* be exact is gated `hex16`. The
  integrator is plain `Number` arithmetic + data-driven `Vars` constants — bit-identical *by
  construction* when op-order is preserved. The only physical exception is the trig ceiling
  (`sin/cos`/`atan2` ≤1 ULP in steering/heading/camera/drafting), handled by strict escalation —
  never a blanket tolerance. (Same protocol as FZ3 `CLAUDE.md` rule 5.)
- **Game (a race): behavioural** — every level is completable, ghosts/replays line up, nothing
  feels off. A behavioural failure is a **signal to hunt the bit-level arcade divergence**, never
  a licence to tune a constant.

**Racing-game nuance (vs FZ3's puzzle game):** mspr is less brutally chaotic than a
physics puzzle, BUT it has two features that make determinism directly visible and
unforgiving — **ghost replays** (`GhostRecordingItem`) and **best-times / medal gates**
(`RacerLevelTime`, `heatrush` gold/silver/bronze). A ghost recorded on the original and
replayed on a drifted port desyncs on screen. So the bit-exact bar stays; "close" still
fails, just in ghosts and leaderboards instead of unsolved puzzles.

### Inviolable rules (identical to FZ3; "engine" now = the arcade car engine)
1. **Bit-exact is the engine's spec.** No tolerance gate labelled "exact".
2. **Never tune physics to fix a level.** Every divergence is a porting bug with one
   correct answer: what the original did. Tuning *is* the whack-a-mole trap.
3. **Preserve operation order exactly.** AS3 `Number` and JS `number` are both IEEE-754
   doubles — a faithful port is bit-identical *by construction* if you preserve
   parenthesisation, temporaries, and evaluation order. Don't "simplify" arithmetic. Cite
   the AS3 file + line range above every ported function.
4. **The oracle is the single source of truth** — the original SWF under Ruffle (it runs
   the *shipped* bytecode). Never guess, never "improve."
5. **Trig ceiling — escalate, never wave away.** (FZ3 rule 5 verbatim. mspr's exposed trig
   surface is steering/heading/camera/drafting, not Box2D TOI; measure early.)
6. **Build the oracle harness FIRST.** Golden #1 (arcade coast, `hex16`) before game code.
   Grow the engine **milestone-gated**: coast → throttle/brake → steering → jump/height →
   car-car collision → track-edge/wall → laps/checkpoints → ghost record/replay; each lands
   with its golden; don't move on until it's green.
7. **No Haxe, no shim. Pure TypeScript, engine called natively.**

## What this project is
Port MS Paint Racers (AS3/Flash, Flash 16, 50 fps) to a faithful, maintainable
**TypeScript** web build. The original SWF is decompiled into `extracted/` (see
`ANALYSIS.md`). Three subsystems, three roles — same split as FZ3, re-weighted for mspr.

## ⚠ Box2D is vestigial in mspr — the real engine is the arcade car integrator
mspr embeds the **exact same Box2DFlash 2.0.2** as FZ3 (all 74 `Box2D/*.as` byte-identical by
MD5) — but **it is never simulated in the shipped game** (see the Prime Directive correction
banner for the static proof: the only `world.Step` lives in the dead `UpdateGameplay_Garage`;
no shipped physobj def even creates a body). Implications:
- **Box2D is NOT mspr's gameplay engine.** We keep FZ3's `src/box2d/` TS port **vendored** (sync
  + hash-guard, `test/box2d-sync.test.ts`) purely for **FZ3 parity and the live engine demo** —
  not because gameplay depends on it. Finishing FZ3's m4/m6/m7 is **FZ3's** concern; mspr does not
  block on it and consumes none of it for determinism.
- **The engine to port bit-exact is the ARCADE car physics:** `GameObj.UpdatePlayer` /
  `UpdateAICar*` (the `zpos += zvel` track-space integrator, state machine, data-driven `Vars`),
  plus `CarCollision` (car↔car push-apart in `xpos/zpos`) and `Collision` (track-edge / wall /
  missile response). ~2,900 LOC of pure `Number` math — bit-identical by faithful porting. This is
  what ghosts record and best-times gate on; **it has its own golden ladder (a0…a7) and is the
  engine colleague's mandate** post-pivot.
- **Constants** (still real, used by the vendored Box2D demo + any physobj path): `physStep=1/80`,
  iterations `10`, `p2w=20`, world AABB `±25000`, gravity `400`→`physGravity=20`. The arcade
  integrator's constants come from `data/vars.json` (`Vars.GetVarAsNumber`), not `b2Settings`.
- `PhysicsBase.as` (397 LOC) is the only Box2D adapter and is effectively dead-on-arrival in the
  ship; `PhysObj`/`PhysLine`/`CarCollision`/`Collision` are pure arcade game logic, **no** Box2D.

## ⚠ The rendering reality — software compositor, NOT GPU (corrects first impressions)
mspr contains a Stage3D GPU batcher (`s3d.as`) — but it is **dead code in the shipped
SWF** (guarded off; `Game.use_texturepages=false`; zero draw-call callers). **The live
renderer is software:**
- `Game.Render(BitmapData)` composites **~7 BitmapData layers** (background / scroll /
  shadow / road / particle / foreground / hud) via `copyPixels`/`draw`.
- `DisplayObjFrame.RenderAtRotScaled*` blits each sprite with a **registration offset,
  rotation, scale, x-flip, full ColorTransform (mult+offset), and a blend mode**
  (`normal`/`add`/`layer`/`overlay`).
- A separate procedural **`RoadRender`** (EditorPackage/RoadEditor/Road.as) draws the
  pseudo-3D track from the road layout + `roaddata` + `road_*` vars.

**Decision: render with a custom WebGL2 2D compositor** (NOT OpenFL — FZ3's display-list
choice does not apply; mspr never uses the display list for gameplay). Use `s3d.as` as the
*batcher design reference* (interleaved VBO, per-texture-page batching, ortho projection,
`texture × vertexColor` shader) but take the **visual semantics** (layer order, blend
modes, ColorTransform, anchor offsets) from the **software path**. The road is its own
renderer. Rendering is NOT bound by the Prime Directive. See `RENDER_DEV.md` (and the
detailed `s3d`→WebGL teardown captured there).

## Target architecture (all TypeScript)
```
Arcade engine    GameObj.UpdatePlayer/UpdateAICar* (zpos+=zvel track-space integrator + state machine)
                 + CarCollision + Collision. Pure Number math, bit-exact, native. THE determinism core.
Box2D (vestigial) Box2DFlash 2.0.2 → TS, vendored from FZ3 (hash-guarded). Never stepped in gameplay;
                 kept for FZ3 parity + the live demo. PhysicsBase.as is its (dead-on-arrival) adapter.
Game framework   GameObj / Game / Levels / Particle / level+data loaders + the race loop (Game.as:1998).
Rendering        Custom WebGL2 2D compositor (software-faithful: layers + blend modes + ColorTransform)
                 + a procedural RoadRender. s3d.as is the batcher reference only.
Data / assets    8 XML blobs → data/*.json (tools/extract_data.py); atlas pipeline (render dev)
Verification     Golden-trace oracle: FFDec -replace into `Preloader` → Ruffle headless → hex16 in vitest
```
**Fixed point:** the game adapts to the engine, never the reverse; the engine never bends to make
a level pass. **The race loop is a single update per displayed frame at 50 fps** (`Defs.fps=50`,
`Main.RunLevel → Game.UpdateGameplay`); the `2×(1/80)` step was the *garage* (Box2D) cadence and
is dead. The arcade update owns determinism; the renderer reads state and never drives the sim.

## The four places faithfulness lives (port line-by-line, golden each — arcade-retargeted)
1. **Arcade collision re-solve order** — the hardest part; mspr's fast cars/missiles hit it.
   `CarCollision.CarCarCollision` + `Collision` resolve in track-space (`xpos/zpos`,
   `collisionDX/DZ`, `oldxpos/oldzpos`) and are **iteration- and list-order-dependent**. Port the
   pass order verbatim. (Analog of FZ3's TOI re-solve, where its worst three bugs lived.)
2. **The per-frame race order + `UpdatePlayer` state machine.** `Game.UpdateGameplay` (Game.as:1998)
   fixes `UpdateControl → Update → KillObjects → DoAddList → CarCollision → camera`; `UpdatePlayer`
   dispatches on `state` (99/98 race-start, 90/100 crossed-line, 80 explode, 70 spin, 0 normal).
   Order and state transitions are load-bearing — trust the `.as`, never reorder for "clarity".
3. **Data-driven `Vars` numeric semantics.** The integrator's constants live in `data/vars.json`
   and are read via `Vars.GetVarAsNumber` — the analog of "`b2Settings` constants verbatim". A
   wrong `Number()` coercion (e.g. blank→0 vs NaN) silently drifts every car. Golden the loader.
4. **Input / ghost-replay determinism.** `KeyReader.Down/Pressed` feed the integrator;
   `GhostRecordingItem` records/replays. The "works in isolation, fails in game" surface: a ghost
   desyncs only after a long replay. Capture goldens **long** (many laps) to expose accumulated drift.

## Verification: the golden-trace oracle (build first — already scaffolded)
Lifted from FZ3 (engine-agnostic capture infra), retargeted to mspr:
1. `tools/oracle/harness-*.as` — document class **`Preloader`** (the SWF's true doc class;
   `Main` is gated behind a cpmstar ad that never fires headless, so we replace `Preloader`),
   deterministic scene, `trace("[TAG] " + i + " " + bits(v))` per step, `[DONE]` sentinel.
   `bits()` = `writeDouble` → two `readUnsignedInt` → hex16. **Never trace decimals.**
2. `node tools/oracle/build-harness.mjs <harness.as>` → `ffdec -replace mspaintracer.swf
   out.swf Preloader <harness.as>` (arg order sensitive). Injects into a copy of the real SWF
   so it links the shipped Box2D bytes.
3. `node tools/oracle/capture-lines.mjs out.swf golden.json` (puppeteer + headless Ruffle).
4. vitest gate: `expect(f64hex(got)).toBe(norm(golden))`.

The rig (Preloader injection + capture) is engine-agnostic. **Golden #1 retargets to the arcade
engine:** a harness that spawns a player car, drives scripted input (start with *coast* — no input,
just rolling-start `zvel`), and traces `(xpos, ypos, zpos, xvel, yvel, zvel, dir, turboVel)` per
`UpdateGameplay`. Grow milestone-gated a0…a7 (coast → throttle → steering → jump → car-car →
track-edge → laps → ghost). **Capture long** (many updates / multiple laps) to expose accumulated
drift — the ghost-desync surface only shows over time.
The old `oracle:build:freefall` / `oracle:capture:freefall` (a Box2D `world.Step` trace) is **kept
only as an FZ3-parity + live-demo check** — it exercises code the shipped game never runs, so it is
**not** a gameplay determinism gate.

## Repo layout
```
mspaintracer.swf            original (CWS, 3.9 MB), from Newgrounds portal 668706
ANALYSIS.md                 SWF teardown / engine + render identification
CLAUDE.md                   this file
ENGINE_DEV.md               brief for the engine developer (arcade car engine; Box2D = vendored parity only)
RENDER_DEV.md               brief for the WebGL renderer developer (incl. s3d→WebGL teardown)
DEVELOPER_MESSAGES.md       shared bidirectional channel (game ↔ engine ↔ render)
contracts/render-state.ts   game→render interface (the RenderFrame the renderer draws)
contracts/game-data.ts      types for data/*.json (raw-string discipline; loader converts)
data/                       extracted JSON (levels, materials, vars, roaddata, …) — built, current
extracted/scripts/          full FFDec AS3 export (594 .as)
extracted/binaryData/       8 embedded XML blobs
tools/ffdec/                JPEXS FFDec 26.2.1 (decompiler + harness injector)
tools/oracle/               golden-trace rig (build-harness, capture-lines, harness-freefall.as)
tools/extract_data.py       XML→JSON transcriber (faithful, raw strings)
tools/swfparse/             scratch SWF/ABC parsers used for the teardown
src/box2d/**                engine: bit-exact Box2DFlash 2.0.2 (lift FZ3's port — identical source)
src/game/**                 game: framework port + level/data loaders + fixed-step loop
src/render/**               render: WebGL2 2D compositor + RoadRender + asset pipeline
test/**                     vitest suites + test/goldens/ + helpers/hex16.ts
package.json / tsconfig.json / vitest.config.ts / vite.config.ts
```

## Team / sessions (same model as FZ3 — comms via `DEVELOPER_MESSAGES.md`)
- **game** (hub) — framework port, level/material data loaders, fixed 2×(1/80) loop,
  integration, owns the contracts.
- **engine** — **(pivoted 2026-06-21)** bit-exact **arcade car engine**: port `GameObj.UpdatePlayer`
  / `UpdateAICar*` (the `zpos+=zvel` integrator + state machine), `CarCollision`, `Collision`,
  golden-gated a0…a7. Maintains the vendored Box2D sync (FZ3 parity) but no longer drives Box2D
  milestones for mspr. First task: golden a0 (arcade coast) via a new Preloader car-harness.
- **render** — WebGL2 software-faithful compositor + procedural RoadRender + SWF→atlas
  asset pipeline (`RENDER_DEV.md`). First task: a spike rendering one sprite (rot/scale/
  flip/ColorTransform) + one additive-blend particle from the extracted assets.
Address messages `To: game|engine|render`. game↔engine and game↔render are bidirectional;
engine↔render route through game.

## Open decisions
1. *(Resolved)* **Shared engine with FZ3 = vendor + hash guard, FZ3 canonical.** Box2D
   source is identical and all mspr-specific config is caller-side, so there's no
   engine-level delta to fork. FZ3's `src/box2d/` is canonical; mspr carries a vendored
   pinned copy synced by `tools/sync-box2d.mjs` and guarded by `test/box2d-sync.test.ts`
   (fails on hand-edit or stale vendor). See DEVELOPER_MESSAGES "shared engine" thread.
2. *(Resolved)* Ground truth = **Ruffle** (runs shipped bytecode).
3. *(Resolved)* Rendering = **custom WebGL2 2D compositor** (software-faithful), NOT
   OpenFL/display-list. s3d is the batcher reference only.
4. *(Resolved)* Data = 8 XML blobs → `data/*.json`, faithful raw strings, loader converts.
5. **Level editor (`EditorPackage`, ~76 classes): DEFER** — authoring tool, not needed to play.
6. *(Resolved 2026-06-21)* **Box2D is vestigial; bit-exact target = the arcade car engine.**
   Static proof: the only `world.Step` is in the zero-caller `UpdateGameplay_Garage`; no shipped
   physobj def creates a body; the race loop never steps Box2D. Pivoted the Prime Directive +
   engine role to the arcade integrator (`GameObj`/`CarCollision`/`Collision`). Box2D stays
   vendored for FZ3 parity only. See DEVELOPER_MESSAGES "Box2D is dead in the ship".
```
