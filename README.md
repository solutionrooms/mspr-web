# mspr — MS Paint Racers → TypeScript

A faithful, bit-exact TypeScript port of the Flash game *MS Paint Racers* (Newgrounds
portal 668706), built the same way as its sibling project **FZ3**: a bit-exact Box2DFlash
2.0.2 engine proven against a golden-trace oracle, a faithful game-framework port, and a
software-faithful WebGL2 renderer.

**Start here:** `CLAUDE.md` (the methodology + the Prime Directive), then `ANALYSIS.md`
(SWF teardown). Role briefs: `ENGINE_DEV.md`, `RENDER_DEV.md`. Coordination:
`DEVELOPER_MESSAGES.md`.

```bash
npm install
npm run bootstrap               # download the SWF + FFDec, regenerate extracted/, data/, render atlas
npm run test                    # vitest: bit-exact (hex16) gates
npm run oracle:build:freefall   # inject the freefall harness into a copy of the SWF (needs Java)
npm run oracle:capture:freefall # run it under headless Ruffle → test/goldens/m0-m1-freefall.json
```

### Content policy (why you must bootstrap)
This is a **public** repo, so it contains **only our work product** — the TypeScript port,
the docs, the contracts, the tooling, and the test goldens. The third-party copyrighted
inputs are **not** committed: the original SWF, the decompiled AS3 (`extracted/`), the
derived game-data JSON (`data/`), the FFDec tool, and the packed sprite atlas. `npm run
bootstrap` re-downloads the freely-available SWF from Newgrounds and regenerates all of
them locally. (The bundled `src/box2d/` is a TypeScript port of the open-source, zlib-
licensed Box2DFlash 2.0.2 — fine to ship.)

Highlights from the analysis:
- **Engine is byte-identical to FZ3's** Box2D — FZ3's TS port lifts 1:1 (constants differ:
  `physStep=1/80`, iters 10, `p2w=20`).
- **Renderer is software** (7-layer BitmapData compositor + procedural road), not the
  dead-code Stage3D path — so we target a custom WebGL2 2D compositor.
- **Content is 8 XML blobs**, already extracted to `data/` and typed in `contracts/`.

Built on JPEXS FFDec (decompile + harness injection) and Ruffle (the oracle).
