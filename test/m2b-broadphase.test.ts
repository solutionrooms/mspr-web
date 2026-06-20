// m2b — SAP broadphase bit-exact gate (mspr config).
//
// Mirrors tools/oracle/harness-broadphase.as: drives the (vendored-from-FZ3)
// b2BroadPhase through CreateProxy / MoveProxy / QueryAABB / DestroyProxy with a plain
// b2PairCallback, and asserts hex16(ours) === golden for the quantized bound arrays
// (value/proxyId/stabbingCount), proxy & pair counts, and query results. Everything is
// integer-valued (quantized endpoints, ids, counts) so this is a PURE bit-exact gate.
//
// CONFIG-DEPENDENT: the broadphase quantizes proxy AABBs against the WORLD AABB, so the
// quantized values depend on it. This gate uses mspr's ±25000 (PhysicsBase.as), NOT
// FZ3's ±2500 — so it proves the SHARED engine is bit-exact at mspr's actual broadphase
// bound, coverage FZ3's golden cannot give.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { b2AABB } from "../src/box2d/Collision/b2AABB";
import { b2BroadPhase } from "../src/box2d/Collision/b2BroadPhase";
import { b2PairCallback } from "../src/box2d/Collision/b2PairCallback";
import { f64hex, norm, type Golden } from "./helpers/hex16";

const __dirname = dirname(fileURLToPath(import.meta.url));
const golden: Golden = JSON.parse(readFileSync(join(__dirname, "goldens", "m2b-broadphase.json"), "utf8"));

type Row = { tag: string; step: number; fields: string[] };
const rows: Row[] = [];
function emit(tag: string, step: number, values: number[]): void {
  rows.push({ tag, step, fields: values.map(f64hex) });
}

let bp: b2BroadPhase;
function makeAABB(x1: number, y1: number, x2: number, y2: number): b2AABB {
  const a = new b2AABB();
  a.lowerBound.Set(x1, y1);
  a.upperBound.Set(x2, y2);
  return a;
}
function dumpState(tag: string): void {
  const n = 2 * bp.m_proxyCount;
  for (let i = 0; i < n; i++) {
    emit(tag + "0", i, [bp.m_bounds[0][i].value, bp.m_bounds[0][i].proxyId, bp.m_bounds[0][i].stabbingCount]);
  }
  for (let i = 0; i < n; i++) {
    emit(tag + "1", i, [bp.m_bounds[1][i].value, bp.m_bounds[1][i].proxyId, bp.m_bounds[1][i].stabbingCount]);
  }
  emit(tag + "C", 0, [bp.m_proxyCount, bp.m_pairManager.m_pairCount]);
}

function run(): void {
  rows.length = 0;
  // mspr world AABB ±25000 (PhysicsBase.as) — the load-bearing difference vs FZ3.
  const worldAABB = new b2AABB();
  worldAABB.lowerBound.Set(-25000, -25000);
  worldAABB.upperBound.Set(25000, 25000);
  bp = new b2BroadPhase(worldAABB, new b2PairCallback());

  const ids: number[] = [];
  ids[0] = bp.CreateProxy(makeAABB(0, 0, 2, 2), 0);
  ids[1] = bp.CreateProxy(makeAABB(1, 1, 3, 3), 1);
  ids[2] = bp.CreateProxy(makeAABB(10, 10, 12, 12), 2);
  ids[3] = bp.CreateProxy(makeAABB(1.5, 1.5, 2.5, 2.5), 3);
  for (let i = 0; i < 4; i++) {
    emit("PROXY", i, [ids[i]]);
  }
  dumpState("A");

  bp.MoveProxy(ids[0], makeAABB(20, 20, 22, 22));
  bp.Commit();
  dumpState("B");

  const result: unknown[] = new Array(16);
  const count = bp.QueryAABB(makeAABB(1, 1, 1.6, 1.6), result, 16);
  emit("QCNT", 0, [count]);
  for (let i = 0; i < count; i++) {
    emit("QRY", i, [Number(result[i])]);
  }

  bp.DestroyProxy(ids[1]);
  dumpState("D");
}

describe("m2b — SAP broadphase (bit-exact, mspr ±25000 world)", () => {
  it("matches the Ruffle golden for bounds, pair/proxy counts, and queries", () => {
    run();
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
