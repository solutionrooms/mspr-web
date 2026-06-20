# src/box2d — bit-exact Box2DFlash 2.0.2 (engine dev)

Owner: **engine** (`ENGINE_DEV.md`). Pure-math module — ZERO game/render/Flash deps.

mspr's `extracted/scripts/Box2D/` is **byte-identical** to FZ3's, so FZ3's
`/Users/jonscott/Projects/FZ3/src/box2d/` port lifts here 1:1. First decide how to share
the engine with FZ3 (co-develop vs fork — see `ENGINE_DEV.md`); don't hand-fork identical
code without a sync/hash guard.

Faithfulness bar: `hex16` against the Ruffle oracle, milestone-gated (freefall →
integration → collision → solver → sleep → joints → CCD/TOI). Copy mspr's constants
(`physStep=1/80`, iters `10`, `p2w=20`, AABB `±25000`) — NOT FZ3's.
