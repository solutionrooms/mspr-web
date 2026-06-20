# src/game — framework port + loaders + fixed-step loop (game dev / hub)

Owner: **game**. Lifts the FZ3/SB2 game-logic skeleton (`GameObj` / `Game` / `Levels` /
`Particle` / `GameObjects`) and rebinds it to the bit-exact Box2D port.

- `data/` — loaders that read `data/*.json` (already extracted) and apply the EXACT AS3
  conversions (`contracts/game-data.ts` raw-string discipline). Start: level loader +
  physobj/material loader feeding `PhysicsBase.AddPhysObjAt`.
- `model/` — `PhysObj` / `PhysLine` / `Collision` defs ported from mspr's wrappers.
- The fixed loop: **2× `world.Step(1/80, 10)` per gameplay update**, then
  `UpdateGOsFromPhysics`. Reproduce the order and per-state gating from `Game.as`.

Produces one `RenderFrame` (`contracts/render-state.ts`) per displayed frame for render.
