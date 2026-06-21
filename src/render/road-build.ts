/**
 * RoadSeg builder (mspr render) — faithful TS port of Road.CreateRoadFromBlocks
 * (EditorPackage/RoadEditor/Road.as:87-159) + the per-block CreateRoadSegment
 * methods. Turns a level's road `blocks` (data/levels.json) + roaddata surface/edge
 * name→index maps + the `road_*` vars into the static `RoadSeg[]` that
 * road-projection.buildDrawSegs consumes. Render owns this (per the locked v2:
 * RoadRender builds the geometry at level-load; game ships only the camera).
 *
 * Scope (P1b, geometry-critical): levelinfo, bend, width, abshill, surface, edge.
 * DEFERRED (not geometry/raster-critical yet): billboard (objs — P4), weather,
 * aizone, solidedge, label, wall, splineheight, + CreateRoadSegment_SecondPass /
 * FullColumnPostCreate. Verification: visual road parity vs Ruffle (the golden-
 * harness path is blocked on game-boot coupling — see DEVELOPER_MESSAGES).
 *
 * Constants (RoadData.as; vars override only globalCurve): globalCurve = road_global_curve
 * (0.1), globalHill = 0.9 (STATIC default — UpdateVars does NOT override it).
 */
import type { RoadSeg } from "./road-projection";

export interface RoadBlockRaw {
  btype: string;
  z: number | string;     // z0
  dist: number | string;  // len
  active: boolean | string;
  params: string;         // "k=v,k=v" CSV
}

export interface RoadBuildConstants {
  globalCurve: number; // RoadData.globalCurve (vars road_global_curve = 0.1)
  globalHill: number;  // RoadData.globalHill = 0.9 (static; not in vars)
  numLaps: number;     // Game.as builds the in-race road with 2 laps
}

export const ROAD_BUILD_DEFAULTS = { globalCurve: 0.1, globalHill: 0.9, numLaps: 2 };

/** Parse the `params="k=v,flag,k=v"` CSV (Utils.GetParams idiom). */
export function parseParams(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!s) return out;
  for (const tok of s.split(",")) {
    const i = tok.indexOf("=");
    if (i < 0) out[tok.trim()] = "true";
    else out[tok.slice(0, i).trim()] = tok.slice(i + 1).trim();
  }
  return out;
}

function newSeg(): RoadSeg {
  return { width: 0, changeX: 0, changeY: 0, surfaceIndex: 0, colL: 0, colR: 0, edgeIndexL: 0, edgeIndexR: 0 };
}

const EDGE_COL = 0xffffffff; // RoadBlock_Edge writes colL/R = 4294967295 unconditionally

/**
 * Build the RoadSeg[] for a level. `surfaceIndexByName`/`edgeIndexByName` map the
 * block's surface_type/edge_type to the roaddata array index (RoadData.GetRoadSurface
 * IndexByName / GetEdgeDefIndexByName). `edgeHasDef` lets edge blocks early-return when
 * the def is missing (RoadBlock_Edge.as guards `def==null`).
 */
export function buildRoadSegs(
  blocks: RoadBlockRaw[],
  surfaceIndexByName: (name: string) => number,
  edgeIndexByName: (name: string) => number,
  edgeHasDef: (name: string) => boolean,
  consts: RoadBuildConstants = ROAD_BUILD_DEFAULTS,
): RoadSeg[] {
  const parsed = blocks.map((b) => ({
    btype: b.btype,
    z0: +b.z,
    len: +b.dist,
    active: b.active === true || b.active === "true",
    params: parseParams(b.params),
  }));

  // lapLength = GetHighestZ() = max(z0+len) over blocks (Road.as:93)
  let lapLength = 0;
  for (const b of parsed) if (b.z0 + b.len > lapLength) lapLength = b.z0 + b.len;
  const total = lapLength * consts.numLaps;
  const segs: RoadSeg[] = new Array(total);
  for (let i = 0; i < total; i++) segs[i] = newSeg();

  // build state (Road.as:107 resets these before the lap loop)
  const state = { lastHillAngle: 0, bendMultiplier: 1, backgroundFrame: 1 };

  // pass 1: each lap, each active block (z offset by lap*lapLength) — Road.as:110-128
  for (let lap = 0; lap < consts.numLaps; lap++) {
    const off = lap * lapLength;
    for (const b of parsed) {
      if (!b.active) continue;
      const z0 = b.z0 + off;
      const z1 = b.z0 + b.len + off;
      applyBlock(b.btype, z0, z1, b.params, segs, total, state, consts, surfaceIndexByName, edgeIndexByName, edgeHasDef);
    }
  }
  return segs;
}

function applyBlock(
  btype: string, z0: number, z1: number, p: Record<string, string>,
  segs: RoadSeg[], total: number,
  state: { lastHillAngle: number; bendMultiplier: number; backgroundFrame: number },
  consts: RoadBuildConstants,
  surfaceIndexByName: (n: string) => number,
  edgeIndexByName: (n: string) => number,
  edgeHasDef: (n: string) => boolean,
): void {
  const lo = Math.max(0, z0);
  const hi = Math.min(total, z1);
  switch (btype) {
    case "levelinfo": {
      // RoadBlock_LevelInfo.CreateRoadSegment: sets the globals bend + bg read (as:28-29)
      state.bendMultiplier = num(p.levelinfo_bendmultiplier, 1);
      state.backgroundFrame = int(p.levelinfo_background, 1);
      break;
    }
    case "bend": {
      // RoadBlock_Bend: changeX = bend_curve * bendMultiplier * globalCurve, flat over [z0,z1).
      // (The 300-unit ramp _loc11_ is computed but never written — dead code; we match the write.)
      const curve = num(p.bend_curve, 0) * state.bendMultiplier;
      for (let z = lo; z < hi; z++) segs[z].changeX = curve * consts.globalCurve;
      break;
    }
    case "width": {
      // RoadBlock_Width: set width over [z0,z1), then linearly ramp the width over
      // [z0-changeDist, z0) from the prior width up to this block's width.
      const w = num(p.width_width, 0);
      const changeDist = num(p.width_changeDist, 0);
      for (let z = lo; z < hi; z++) segs[z].width = w;
      let zStart = z0 - changeDist;
      if (zStart < 0) zStart = 0;
      const zEnd = z0;
      if (zEnd > zStart && zStart < total) {
        const wStart = segs[zStart].width;
        const wEnd = segs[Math.min(zEnd, total - 1)].width;
        const slope = (wEnd - wStart) / (zEnd - zStart);
        let cur = wStart;
        for (let z = zStart; z < Math.min(zEnd, total); z++) { segs[z].width = cur; cur += slope; }
      }
      break;
    }
    case "abshill": {
      // RoadBlock_Abshill: changeY = ((hill_angle - lastHillAngle)/len) * globalHill, flat;
      // lastHillAngle accumulates across blocks (and laps). abshill (absolute angle) is
      // tracked but not needed by the projection (cy double-integrates changeY).
      const angle = num(p.hill_angle, 0);
      const len = z1 - z0;
      const slope = len !== 0 ? (angle - state.lastHillAngle) / len : 0;
      for (let z = lo; z < hi; z++) {
        segs[z].changeY = slope * consts.globalHill;
        state.lastHillAngle += slope;
      }
      break;
    }
    case "surface": {
      // RoadBlock_Surface: surfaceIndex = GetRoadSurfaceIndexByName(surface_type)
      const idx = surfaceIndexByName(str(p.surface_type));
      for (let z = lo; z < hi; z++) segs[z].surfaceIndex = idx;
      break;
    }
    case "edge": {
      // RoadBlock_Edge: per side, colL/R = 0xFFFFFFFF + edgeIndexL/R; skip if def missing.
      const name = str(p.edge_type);
      if (!edgeHasDef(name)) break;
      const side = str(p.edge_side);
      const idx = edgeIndexByName(name);
      for (let z = lo; z < hi; z++) {
        const s = segs[z];
        if (side === "left") { s.colL = EDGE_COL; s.edgeIndexL = idx; }
        else if (side === "right") { s.colR = EDGE_COL; s.edgeIndexR = idx; }
        else { s.colL = EDGE_COL; s.colR = EDGE_COL; s.edgeIndexL = idx; s.edgeIndexR = idx; }
      }
      break;
    }
    // DEFERRED: billboard, weather, aizone, solidedge, label, wall, splineheight.
    default:
      break;
  }
}

// AS3-faithful coercions (Number()/int()/String() with absent→default)
function num(v: string | undefined, def = 0): number { if (v == null || v === "") return def; const n = Number(v); return Number.isNaN(n) ? def : n; }
function int(v: string | undefined, def = 0): number { return Math.trunc(num(v, def)); }
function str(v: string | undefined): string { return v == null ? "" : v; }
