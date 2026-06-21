/**
 * RoadRender projection (mspr render) — faithful TS port of
 * RoadRender.BuildDrawSegs (EditorPackage/RoadEditor/RoadRender.as:108-287) and
 * SetCameraPos/SetupRender (:77-92). This is the pseudo-3D heart: it turns the
 * static per-level road segments + the camera-along-track into per-frame projected
 * draw segments (screen-space road edges + perspective scale per segment), plus the
 * hill-occlusion `highestY`. The raster (road strips) and per-object placement
 * consume these (P3/P4); this module is the math, contract-independent.
 *
 * Projection (BuildDrawSegs:201-204, identical to V3.PerspectiveTransform1):
 *     scale = fov / (1 + z)            // z = depth from camera (realZStep-spaced units)
 *     screenX = worldXlateral * scale + horizonX
 *     screenY = worldYheight  * scale + horizonY
 * Curve + hill are a discrete DOUBLE integration of per-segment changeX/changeY
 * (rate += change; pos += rate — RoadRender.as:183-186), so changeX/changeY are the
 * lateral/vertical "acceleration" that bends the road into curves and hills.
 */

/** RoadData/vars constants (defaults from RoadData.as; overridden by data/vars.json
 *  road_* — realZStep=10, fov=70, num_segments=1000, object_maxz=700). horizonX/Y and
 *  textureZScale have no road_* var (stay at the RoadData defaults). */
export interface RoadConstants {
  fov: number;            // RoadData.fov  (vars road_fov = 70)
  realZStep: number;      // RoadData.realZStep (vars road_realzstep = 10)
  numSegsToRender: number;// RoadData.numSegsToRender (vars road_num_segments = 1000)
  horizonX: number;       // RoadData.horizonX = 320 (vanishing point X, @640 wide)
  horizonY: number;       // RoadData.horizonY = 300 (vanishing point Y, @480 tall)
  textureZScale: number;  // RoadData.textureZScale = 0.2 (road texture V scroll rate)
}

export const ROAD_DEFAULTS: RoadConstants = {
  fov: 70, realZStep: 10, numSegsToRender: 1000, horizonX: 320, horizonY: 300, textureZScale: 0.2,
};

/** Static per-level road segment geometry (built once by Road.CreateRoadSegment;
 *  RoadSeg.as fields). Only the fields the projection + raster need. P1 (level →
 *  RoadSeg[]) produces these; objs/billboards (P4) hang off the segment separately. */
export interface RoadSeg {
  width: number;        // half-width of the road at this segment
  changeX: number;      // lateral curvature accel (curve)
  changeY: number;      // vertical accel (hill)
  surfaceIndex: number; // road-surface texture index (-1 → 0)
  colL: number;         // left-edge present flag (RoadSeg.colL; 0 = none)
  colR: number;         // right-edge present flag
  edgeIndexL: number;   // left-edge texture index
  edgeIndexR: number;   // right-edge texture index
}

export interface Camera3D {
  x: number; // renderXPos — lateral (NEGATED into the build: SetupRender:88)
  y: number; // renderYPos — height
  z: number; // renderZPos — along-track distance; FRACTIONAL → smooth sub-seg scroll
}

/** One projected draw segment (RoadDrawSeg). */
export interface RoadDrawSeg {
  z: number;        // depth from camera (realZStep units, incl. sub-seg offset)
  wz: number;       // absolute world-z (for texture V scroll)
  cx: number;       // accumulated lateral centre (world)
  cy: number;       // accumulated height (world)
  surface: number;  // resolved surface index
  x0: number;       // projected screen-X of left road edge
  x1: number;       // projected screen-X of right road edge
  ypos: number;     // projected screen-Y of the road at this segment
  highestY: number; // hill-occlusion clip (segments behind a crest share its ypos)
  colL: number; colR: number; edgeIndexL: number; edgeIndexR: number;
}

export interface DrawSegResult {
  drawSegs: RoadDrawSeg[]; // length = count
  count: number;
  render_highestY: number; // crest used for the background fill height
  render_cx: number;       // horizonX in buffer px
  render_cy: number;       // horizonY in buffer px
  render_z0: number;       // first road-seg index drawn
  render_z1: number;       // last road-seg index (exclusive bound)
}

/**
 * Port of RoadRender.BuildDrawSegs. `bdWidth/bdHeight` = the target buffer size
 * (640×480 in-game; horizonX/Y are scaled to it, RoadRender.as:190-191).
 * cx0/cy0/camZ come from SetupRender: cx0 = -camera.x, cy0 = camera.y, camZ = camera.z.
 */
export function buildDrawSegs(
  roadSegs: RoadSeg[],
  camera: Camera3D,
  consts: RoadConstants = ROAD_DEFAULTS,
  bdWidth = 640,
  bdHeight = 480,
): DrawSegResult {
  const { fov, realZStep, numSegsToRender, horizonX, horizonY } = consts;
  const empty: DrawSegResult = {
    drawSegs: [], count: 0, render_highestY: 99999,
    render_cx: (horizonX / 640) * bdWidth, render_cy: (horizonY / 480) * bdHeight,
    render_z0: 0, render_z1: 0,
  };
  if (roadSegs.length === 0) return empty;

  let cx = -camera.x;       // SetupRender:88 (lateral negated)
  let cy = camera.y;        // SetupRender:89
  const camZ = camera.z;

  // ZStepOffset = -(frac(camZ) * realZStep) — sub-segment smooth scroll (:129-130)
  const ZStepOffset = -((camZ - Math.floor(camZ)) * realZStep);
  let z0 = Math.trunc(camZ);                       // int(camZ) (:133)
  let z1 = z0 + numSegsToRender;                   // (:138)
  if (z1 > roadSegs.length - 1) z1 = roadSegs.length - 1; // (:139-142)
  if (z0 < 0) z0 = 0;                              // (:161-163)

  const n = z1 - z0;
  if (n <= 0) return { ...empty, render_z0: z0, render_z1: z1 };
  const drawSegs: RoadDrawSeg[] = new Array(n);

  // --- pass 1: accumulate cx/cy/z per draw segment (:165-189) ---
  let cxRate = 0, cyRate = 0;          // _loc27_/_loc28_ — first derivative
  let zAcc = ZStepOffset;              // _loc22_
  for (let i = 0; i < n; i++) {
    const seg = roadSegs[z0 + i];
    let surface = seg.surfaceIndex;
    if (surface === -1) surface = 0;
    drawSegs[i] = {
      z: zAcc, cx, cy, surface,
      wz: zAcc + z0 * realZStep - ZStepOffset,    // absolute world-z (:181)
      x0: 0, x1: 0, ypos: 0, highestY: 99999,
      colL: seg.colL, colR: seg.colR, edgeIndexL: seg.edgeIndexL, edgeIndexR: seg.edgeIndexR,
    };
    zAcc += realZStep;
    cxRate += seg.changeX;             // double integration (:183-186)
    cyRate += seg.changeY;
    cx += cxRate;
    cy += cyRate;
  }

  // --- pass 2: perspective-project each draw segment (:190-225) ---
  const horizonXpx = (horizonX / 640) * bdWidth;   // (:190)
  const horizonYpx = (horizonY / 480) * bdHeight;  // (:191)
  for (let i = 0; i < n; i++) {
    const seg = roadSegs[z0 + i];
    const ds = drawSegs[i];
    const left = ds.cx - seg.width;
    const right = ds.cx + seg.width;
    const scale = (1 / (1 + ds.z)) * fov;          // (:201)
    ds.x0 = left * scale + horizonXpx;
    ds.x1 = right * scale + horizonXpx;
    ds.ypos = ds.cy * scale + horizonYpx;
  }

  // --- render_highestY: crest for the bg fill (skips nearest 5; :226-237) ---
  let render_highestY = 99999;
  for (let i = 5; i < n; i++) {
    if (drawSegs[i].ypos < render_highestY) render_highestY = drawSegs[i].ypos;
  }

  // --- hill occlusion: find crests (local minima in screen-Y), then walk near→far
  //     assigning each seg the ypos of the nearest crest ahead (:238-278) ---
  const crests: Array<{ index: number; ypos: number }> = [];
  for (let i = 0; i < n - 2; i++) {
    const a = drawSegs[i], b = drawSegs[i + 1], c = drawSegs[i + 2];
    if (a.ypos > b.ypos && c.ypos > b.ypos) crests.push({ index: i, ypos: b.ypos });
  }
  if (crests.length >= 1) {
    let k = 0;
    let curY = crests[0].ypos;
    let curIdx = crests[0].index;
    for (let i = n - 1; i >= 0; i--) {
      drawSegs[i].highestY = curY;
      if (i < curIdx) {
        if (++k >= crests.length) curY = 99999;
        else { curY = crests[k].ypos; curIdx = crests[k].index; }
      }
    }
  }

  return {
    drawSegs, count: n, render_highestY,
    render_cx: horizonXpx, render_cy: horizonYpx, render_z0: z0, render_z1: z1,
  };
}
