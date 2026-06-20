# mspr — MS Paint Racers → TypeScript port

Sibling project to **FZ3** (`/Users/jonscott/Projects/FZ3`), same studio lineage, same
methodology. We are porting the same way: a bit-exact physics engine proven against a
golden-trace oracle, a faithful game-framework port, and a renderer chosen for fidelity.
Read FZ3's `CLAUDE.md` for the long-form rationale — this file states what's the **same**
and what's **different** for mspr, and the differences are load-bearing.

## ⛔ THE PRIME DIRECTIVE: bit-faithful physics, proven mechanically

**The physics engine must reproduce the original's IEEE-754 output bit-for-bit** —
`hex16(ours) === hex16(original)` for every body's `(x, y, angle, vx, vy, ω)` on **every**
simulation step. Tolerance comparisons (`abs(a−b) < ε`) are **banned** as the primary
correctness gate. Two bars (per FZ3/SB2 experience):
- **Engine (physics math): bit-exact.** Everything that *can* be exact is gated `hex16`.
  The only physical exception is the trig ceiling (`sin/cos` ≤1 ULP), handled by strict
  escalation — never a blanket tolerance. (Same protocol as FZ3 `CLAUDE.md` rule 5.)
- **Game (a race): behavioural** — every level is completable, ghosts/replays line up,
  nothing feels off. A behavioural failure is a **signal to hunt the bit-level engine
  divergence**, never a licence to tune a constant.

**Racing-game nuance (vs FZ3's puzzle game):** mspr is less brutally chaotic than a
physics puzzle, BUT it has two features that make determinism directly visible and
unforgiving — **ghost replays** (`GhostRecordingItem`) and **best-times / medal gates**
(`RacerLevelTime`, `heatrush` gold/silver/bronze). A ghost recorded on the original and
replayed on a drifted port desyncs on screen. So the bit-exact bar stays; "close" still
fails, just in ghosts and leaderboards instead of unsolved puzzles.

### Inviolable rules (identical to FZ3)
1. **Bit-exact is the engine's spec.** No tolerance gate labelled "exact".
2. **Never tune physics to fix a level.** Every divergence is a porting bug with one
   correct answer: what the original did. Tuning *is* the whack-a-mole trap.
3. **Preserve operation order exactly.** AS3 `Number` and JS `number` are both IEEE-754
   doubles — a faithful port is bit-identical *by construction* if you preserve
   parenthesisation, temporaries, and evaluation order. Don't "simplify" arithmetic. Cite
   the AS3 file + line range above every ported function.
4. **The oracle is the single source of truth** — the original SWF under Ruffle (it runs
   the *shipped* bytecode). Never guess, never "improve."
5. **Trig ceiling — escalate, never wave away.** (FZ3 rule 5 verbatim. mspr's TOI is the
   exposed surface; measure early.)
6. **Build the oracle harness FIRST.** Golden #1 (freefall, `hex16`) before game code.
   Grow the engine **milestone-gated**: freefall → integration → collision → solver →
   sleep → joints → CCD/TOI; each lands with its golden; don't move on until it's green.
7. **No Haxe, no shim. Pure TypeScript, engine called natively.**

## What this project is
Port MS Paint Racers (AS3/Flash, Flash 16, 50 fps) to a faithful, maintainable
**TypeScript** web build. The original SWF is decompiled into `extracted/` (see
`ANALYSIS.md`). Three subsystems, three roles — same split as FZ3, re-weighted for mspr.

## ✅ The engine is (almost) free — Box2D is byte-identical to FZ3
mspr embeds the **exact same Box2DFlash 2.0.2** as FZ3 — all 74 `Box2D/*.as` files are
**byte-for-byte identical** (verified by aggregate MD5). **FZ3's `src/box2d/` TypeScript
port lifts to mspr 1:1, zero re-porting.** Caveats:
- FZ3's port is **partial** (m0/m1 done, m2 collision in progress; solver/joints/TOI not
  started). mspr *uses* joints + contacts + solver, so those milestones must be finished —
  but that's **shared work with FZ3** (identical source). Strong case to **co-develop the
  engine once** and consume it from both repos rather than fork. Settle this first
  (`ENGINE_DEV.md`).
- **Constants differ and are load-bearing — copy mspr's, never FZ3's:** `physStep=1/80`
  (not 1/60), iterations `10` (not 5), `p2w=20` (not 50), world AABB `±25000`, gravity
  `400` → `physGravity=20`. The integrator math is identical; the configuration is not.
- mspr's only Box2D-touching adapter is `PhysicsBase.as` (397 LOC, ~52 lines different
  from FZ3's). The rest of the physics layer (`PhysObj`/`PhysLine`/`CarCollision`/
  `Collision`, ~2,900 LOC) is pure game logic with **no** Box2D coupling.

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
Physics engine   Box2DFlash 2.0.2 → TS, bit-exact, native. IDENTICAL source to FZ3 — lift FZ3's port.
Engine wrapper   PhysicsBase / PhysObj / Collision / ContactListener (mspr's own Box2D wrapper — port fresh)
Game framework   GameObj / Game / Levels / Particle / level+data loaders (lift skeleton; rebind to Box2D)
Rendering        Custom WebGL2 2D compositor (software-faithful: layers + blend modes + ColorTransform)
                 + a procedural RoadRender. s3d.as is the batcher reference only.
Data / assets    8 XML blobs → data/*.json (tools/extract_data.py); atlas pipeline (render dev)
Verification     Golden-trace oracle: FFDec -replace into `Preloader` → Ruffle headless → hex16 in vitest
```
**Fixed point:** the game adapts to the engine, never the reverse. The engine ships
self-contained and never bends to make a level pass. **Our fixed 2×(1/80) step loop owns
determinism;** the renderer reads state and never drives the sim.

## The four places faithfulness lives (port line-by-line, golden each — same as FZ3)
1. **CCD / TOI re-solve order** — the hardest part; mspr's fast cars/missiles hit it.
   Port `b2TimeOfImpact` + `b2World::SolveTOI` + the sub-step solve verbatim. (FZ3's worst
   three bugs lived here — read FZ3 `CLAUDE.md` "four places" #1.)
2. **`b2Settings` constants & the 2.0.x iteration model.** Copy every constant verbatim;
   2.0.x runs Baumgarte/position-correction *inline* (not the separate position loop of
   2.1+). Trust the `.as`, never memory of modern Box2D.
3. **`b2Body::ShouldCollide` / `collideConnected`.** Jointed bodies that fully overlap
   (a car chassis fixture inside its wheel) pin the assembly if you skip this. Golden two
   overlapping jointed bodies up front.
4. **Sleep / wake (`m_sleepTime`).** In 2.0.x several velocity setters do NOT call
   `WakeUp()` — audit every mutator. The #1 "works in isolation, fails in game" source;
   only surfaces after a body has been still ~1s. Capture goldens long enough to SLEEP.

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

`npm run oracle:build:freefall && npm run oracle:capture:freefall` produces golden #1
(M0/M1 freefall) using mspr's world config. **Run captures long enough for a body to
actually SLEEP** (≥ ~40 steps + settle; FZ3 shipped-then-found a sleep bug at step 67).

## Repo layout
```
mspaintracer.swf            original (CWS, 3.9 MB), from Newgrounds portal 668706
ANALYSIS.md                 SWF teardown / engine + render identification
CLAUDE.md                   this file
ENGINE_DEV.md               brief for the Box2D engine developer
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
- **engine** — bit-exact Box2D (lift FZ3's port + finish m2/m4/m6/m7 milestones + port the
  ~52-line-different `PhysicsBase`). First task: settle the shared-engine-with-FZ3
  question (`ENGINE_DEV.md`).
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
```
