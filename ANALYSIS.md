# MS Paint Racers — SWF analysis

## File
- **Source:** downloaded from Newgrounds portal/view/668706 →
  `https://uploads.ungrounded.net/668000/668706_mspaintracer.swf`
- **In repo:** `mspaintracer.swf` (4,050,020 bytes, zlib-compressed `CWS`)
- **Full export:** `extracted/` (FFDec) — `scripts/` (594 `.as`) + `binaryData/` (8 XML blobs)
- **Decompiler:** JPEXS FFDec 26.2.1 (`tools/ffdec/`)

## SWF header
| Property | Value |
|---|---|
| Signature | `CWS` (zlib-compressed) |
| Flash version | 16 (Flash Player 11+ era) |
| Stage display area | 640 × 480 (`Defs.displayarea_w/h`) |
| Frame rate | 50 fps (`Main.MainLoop` on ENTER_FRAME) |
| ActionScript | **AS3** (2 × `DoABC` tags) |
| Document class | **`Preloader`** (← harness `-replace` target, as FZ3). It shows a cpmstar ad then `new Main()`; `Main` never constructs headless (the ad callback never fires), so the harness replaces `Preloader`. |
| Developer | MS Paint Racers (sponsored portal release; CPMStar / AddictingGames / Mochi) |

## Physics engine — **Box2DFlash 2.0.2** (BYTE-IDENTICAL to FZ3)
74 `.as` files under `extracted/scripts/Box2D/`. Verified (aggregate MD5) **byte-for-byte
identical** to Flaming Zombooka 3's Box2D — same decompile of the same shipped engine.
**Consequence: FZ3's bit-exact TypeScript port lifts 1:1; no re-porting of the engine.**

Version fingerprint (2.0.x line): has `b2XForm` (not `b2Transform`), `b2_maxProxies=1024`,
`b2_toiSlop`, `b2_maxTOIContactsPerIsland=32`, `b2_velocityThreshold=1`.

### World setup (`extracted/scripts/PhysicsBase.as`) — **constants DIFFER from FZ3**
```
world AABB        : (-25000,-25000) → (25000,25000)     [FZ3: ±2500]
gravity           : GameVars.gravity = 400 px/s²        [FZ3: 300]
pixels-per-meter  : p2w = 20  (20 px = 1 Box2D metre)   [FZ3: 50]   → w2p = 0.05
physGravity       : 400 * w2p = 20  (world units)
fixed timestep    : physStep = 1/80 s                   [FZ3: 1/60]
solver iterations : physNumIterations = 10              [FZ3: 5]
allowSleep        : true
```
Joints used: revolute, prismatic, pulley, distance, mouse. Custom `ContactListener`.

### The step cadence (`Game.as`) — **2× substeps per frame** (same pattern as FZ3)
```as3
PhysicsBase.world.Step(PhysicsBase.physStep, PhysicsBase.physNumIterations);  // step 1
PhysicsBase.world.Step(PhysicsBase.physStep, PhysicsBase.physNumIterations);  // step 2
GameObjects.UpdateGOsFromPhysics();
```
Two back-to-back `1/80` steps per gameplay update (e.g. `UpdateGameplay_Garage`, and the
in-race update). Reproduce the count, order, and the per-state gating EXACTLY.

### Game-physics wrappers (mspr-specific — port fresh, FZ3 has close templates)
`PhysicsBase.as` (397 LOC, the ONLY Box2D adapter — differs from FZ3's by ~52 lines),
`PhysObj.as` (defs), `PhysLine.as` (geometry), `CarCollision.as` (the game's OWN arcade
car-vs-car layer, not Box2D), `Collision.as`, `PhysObj_BodyUserData`/`JointUserData`.

## Rendering — **software BitmapData compositor** (NOT GPU)
The Stage3D GPU batcher `s3d.as` is present but **dead code in the shipped SWF**
(`if(false==false){return;}` guards, `Game.use_texturepages=false`, zero draw-call
callers). The live renderer is **software**: `Game.Render(BitmapData)` composites ~7
BitmapData layers (`copyPixels`/`draw`), `DisplayObjFrame.RenderAtRotScaled*` blits each
sprite (registration offset + rot + scale + xflip + full ColorTransform + blend mode
normal/add/layer/overlay), and a separate procedural **`RoadRender`** draws the pseudo-3D
track from the road layout. Port target = a custom **WebGL2 2D compositor**; `s3d` is the
batcher design reference only. See `RENDER_DEV.md`.

## Content — 8 embedded XML data blobs (`extracted/binaryData/`, all plain XML)
Extracted to `data/*.json` by `tools/extract_data.py` (faithful raw-string transcription):

| Blob | → data/ | Content |
|---|---|---|
| `485.bin` | `levels.json` | **8 levels** (COAST/FOREST/MOUNTAIN/DESERT ×2). A track = ordered `<block>` list by `btype` (bend/abshill/width/surface/edge/billboard/weather/aizone/solidedge/label/levelinfo) + checkpoint objs. The 3 "author" classes (Ben/Julian/final) embed THIS same file — treat as 8 canonical. |
| `491_…ObjectsData` | `materials/physobjs/aicars/objparams/colors/constants/polymats.json` | 16 Box2D materials, physobj defs, 8 AI cars + 9 groups, 87 editor objparams, 19-colour palette |
| `487_Vars` | `vars.json` | 119 tuning constants (nitro/spin/road/turbo/upgrade/…) |
| `488_RoadData` | `roaddata.json` | 30 billboards, road surfaces, edges, 13 physical surfaces (grip/speed) |
| `489_Achievements` | `achievements.json` | 10 achievements (test/pass func dispatch) |
| `490_ExportedBitmapsData` | `caroffsets.json` | 12 car sprite pivot/offset records (NOT a UV atlas) |
| `492_TextStrings` | `textstrings.json` | 68 localised strings (EN/FR/DE/PT/ES/NL/TR/SE/IT) |
| `486_font_komika_axis_28` | — | BMFont glyph atlas (render asset; skipped) |

Two recurring parser idioms: `params="k=v,k=v"` CSV, and CSV number/point arrays. A
cross-blob name-reference graph: level block params → RoadData defs → ObjectsData
(aicars/materials/colors). Resolve RoadData + ObjectsData before/with Levels.

## Game framework (same studio lineage as FZ3 / SoccerBalls2, slightly later revision)
`GameObj` (6033 LOC) / `GameObj_Base` (3041) / `Game` (3211) / `GameObjects` / `Levels` /
`Particle` / `KeyReader` / `Audio` / `ExternalData` / `Collision` / `GraphicObjects` —
the same class set FZ3 documents, so the "lift the TS game-logic skeleton, rebind to
Box2D" approach carries over. mspr extras: a built-in level/road editor
(`EditorPackage`, ~76 classes — DEFER; authoring tool, not needed to play), ghost
replays (`GhostRecordingItem`) and best-times (`RacerLevelTime`) — the places where
sim determinism is visible.

## How it was extracted
1. Download SWF from Newgrounds (asset URL pulled from the portal page's `embedController` JSON).
2. Decompress `CWS` zlib body; parse tags / ABC constant pool for fingerprinting (`tools/swfparse/`).
3. Full asset + AS3 + binaryData export with FFDec (`tools/ffdec/`).
