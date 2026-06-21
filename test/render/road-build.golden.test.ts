// Road-geometry GOLDEN gate: my TS buildRoadSegs (src/render/road-build.ts) vs the
// REAL shipped Road.CreateRoadFromBlocks output, captured from Ruffle by
// tools/oracle/harness-roadsegs.as (Game.InitOnce bootstrap → road.InitForLevel(2)),
// first 1500 segs of level 0 ("COAST"), each field as raw f64 bits.
//
// Rendering is NOT Prime-Directive-bound, but the geometry is deterministic, so we hold
// the bar high: width/changeX/changeY exact-or-1ULP, the int fields (surfaceIndex/col/
// edge) EXACT. data/ is gitignored (bootstrap-regenerated) → the build half skips without
// it; the golden is committed.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildRoadSegs, ROAD_BUILD_DEFAULTS } from "../../src/render/road-build";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const goldenPath = join(root, "test", "goldens", "road-coast.json");
const levelsPath = join(root, "data", "levels.json");
const roaddataPath = join(root, "data", "roaddata.json");

function f64(hex: string): number {
  return Buffer.from(hex, "hex").readDoubleBE(0);
}

describe("road-build golden (level 0 COAST vs shipped roadSegs)", () => {
  const have = existsSync(goldenPath) && existsSync(levelsPath) && existsSync(roaddataPath);
  it.runIf(have)("buildRoadSegs matches the [RSEG] golden field-for-field", () => {
    const golden = JSON.parse(readFileSync(goldenPath, "utf8")).golden.RSEG as { step: number; fields: string[] }[];
    const levels = JSON.parse(readFileSync(levelsPath, "utf8"));
    const roaddata = JSON.parse(readFileSync(roaddataPath, "utf8"));

    const surfaceIdx = new Map<string, number>(roaddata.roadsurfaces.map((s: any, i: number) => [s.name, i]));
    const edgeIdx = new Map<string, number>(roaddata.edgesegments.map((e: any, i: number) => [e.name, i]));
    const segs = buildRoadSegs(
      levels[0].road.blocks,
      (n: string) => surfaceIdx.get(n) ?? 0,
      (n: string) => edgeIdx.get(n) ?? 0,
      (n: string) => edgeIdx.has(n),
      ROAD_BUILD_DEFAULTS, // 2 laps
    );

    expect(golden.length).toBe(1500);
    let exactFloat = 0;
    for (const row of golden) {
      const i = row.step;
      const g = row.fields.map(f64); // [width, changeX, changeY, surfaceIndex, colL, colR, edgeIndexL, edgeIndexR]
      const s = segs[i];
      // floats: exact when op order matches; allow ≤1 ULP-ish slack (rendering not bit-gated)
      expect(s.width).toBeCloseTo(g[0], 9);
      expect(s.changeX).toBeCloseTo(g[1], 12);
      expect(s.changeY).toBeCloseTo(g[2], 12);
      if (s.width === g[0] && s.changeX === g[1] && s.changeY === g[2]) exactFloat++;
      // ints: EXACT (colL/R compared as unsigned 32-bit)
      expect(s.surfaceIndex).toBe(g[3]);
      expect(s.colL >>> 0).toBe(g[4]);
      expect(s.colR >>> 0).toBe(g[5]);
      expect(s.edgeIndexL).toBe(g[6]);
      expect(s.edgeIndexR).toBe(g[7]);
    }
    // report how many were bit-exact on the floats (informational)
    console.log(`[road-golden] ${exactFloat}/1500 segs bit-exact on width/changeX/changeY`);
  });
});
