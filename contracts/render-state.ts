/**
 * mspr render-state contract — v2 (LOCKED, game ↔ render co-design)  — the live contract.
 * Owner: game produces one RenderFrame per displayed frame; render draws it.
 *
 * WHY v2 (replaces the v1 flat-layer model): the shipped Game.Render (Game.as:2371) is NOT
 * a back-to-front composite of ~7 named BitmapData layers. It is pseudo-3D:
 *   1. ONE accumulation buffer.
 *   2. The ROAD RENDERER is the primary compositor — RoadRender.AddGameObjects
 *      (RoadRender.as:700) depth-sorts every is3DObject GameObj by track-Z (zpos),
 *      perspective-projects it (scale = fov/(1+z)) and draws it INTERLEAVED with the road
 *      segments. Cars / pickups / debris are ONE pseudo-3D pass in TRACK coords.
 *   3. Screen-space passes onto the same buffer: RenderOverlayStuff → Particles → Dash →
 *      Lensflare (Game.as:2429-2432).
 *   4. Full-screen post: tilt + screen-shake + 1.1x zoom (Game.as:2437-2444) + turbo nitro
 *      ColorTransform (2449).
 *   5. HUD: Weather overlay, bend arrows, panel (2452-2455).
 *
 * OWNERSHIP:
 *   - RENDER owns RoadRender end-to-end: the static RoadSeg geometry (built once per level
 *     from level road.blocks + roaddata + road_* vars), the projection (BuildDrawSegs), the
 *     road-strip raster, and per-object perspective placement → compositor.drawSprite.
 *   - GAME supplies, per frame: the camera (x,y,z), the is3DObject list in TRACK coords, the
 *     screen-space overlay/HUD list, the post-process state, and the background state.
 *
 * Rendering is NOT bound by the Prime Directive (visual, not physics) — the fixed 2×(1/80)
 * sim loop owns determinism; render reads the emitted frame.
 */

export interface ColorTransformLike {
  redMultiplier: number;
  greenMultiplier: number;
  blueMultiplier: number;
  alphaMultiplier: number;
  redOffset: number;
  greenOffset: number;
  blueOffset: number;
  alphaOffset: number;
}

/** Flash blend modes actually used: 'normal' (whole GameObj_Base path) + 'add' (effects).
 *  layer/overlay confirmed dead (no callers) — dropped from the union. */
export type BlendMode = "normal" | "add";

/* ───────────────────────── 3D (track-space) objects ──────────────────────────
 * A GameObj with is3DObject. The renderer finds its road segment from zpos, applies the
 * segment's perspective scale = fov/(1+z) (RoadRender.AddGameObjects:724-770), and draws it
 * with compositor.drawSprite. Positions are TRACK coords, NOT screen pixels. */
export interface Object3D {
  /** SWF clip/linkage name (atlas key). Cars = "Cars" (the layer-stack is dead). */
  clip: string;
  /** 0-based frame within the clip (car model frame, animation frame, …). */
  frame: number;
  /** Lateral offset from road centre, world units (RoadObj.xpos; +right). */
  xpos: number;
  /** Along-track distance, world units (GameObj.zpos). Renderer maps to a segment. */
  zpos: number;
  /** Height above the road surface, world units (0 = on road). Default 0. */
  ypos?: number;
  /** Rotation in RADIANS (Flash convention; +cw on the y-down stage). */
  dir: number;
  /** Per-object scale, MULTIPLIED by the segment's perspective scale. */
  scale: number;
  /** Horizontal flip (mirrors sprite + rotation — RenderAtRotScaled_Xflip). */
  xflip: boolean;
  /** zpos wraps modulo lap length (RoadRender.AddGameObjects:731). Default false. */
  useLapForRender?: boolean;
  /** Use ypos as absolute screen Y rather than road-relative (RoadObj.useAbsoluteYpos). */
  useAbsoluteYpos?: boolean;
  /** Pivot override; default = atlas pivot for (clip,frame) (cars: caroffsets). */
  xoff?: number;
  yoff?: number;
  /** IGNORED when blend==='add' (DisplayObjFrame.as:346). */
  colorTransform?: ColorTransformLike;
  /** Default false = NEAREST (GameObj_Base.renderSmooth). */
  smooth?: boolean;
  /** Default 'normal'. */
  blend?: BlendMode;
}

/* ────────────────────────── screen-space overlays ────────────────────────────
 * Drawn after the road+3D pass: RenderOverlayStuff, Particles, Dash, Lensflare
 * (Game.as:2429-2432). Pre-projected screen pixels (camera already baked). Maps onto
 * compositor.drawSprite directly. */
export interface OverlayObj {
  clip: string;
  frame: number;
  /** Screen-space px (top-left origin, y-down). */
  x: number;
  y: number;
  dir: number;
  scale: number;
  xflip: boolean;
  xoff?: number;
  yoff?: number;
  colorTransform?: ColorTransformLike;
  smooth?: boolean;
  blend?: BlendMode;
  /** Drawn in the HUD pass (after the post-process) vs the pre-post overlay pass. */
  afterPost?: boolean;
}

/* ──────────────────────────────── road ───────────────────────────────────────
 * Per-frame camera + dynamic road state. Static segment geometry is owned by the renderer
 * (built from the level). SetCameraPos(x,y,z) inputs (RoadRender.as:77; renderer NEGATES
 * lateral internally — pass the raw follow-cam lateral). */
export interface RoadState {
  /** Camera lateral position along the track (renderXPos). */
  cameraX: number;
  /** Camera vertical / height (renderYPos). */
  cameraY: number;
  /** Camera distance along track (renderZPos). FRACTIONAL → smooth sub-segment scroll. */
  cameraZ: number;
  /** Surface set / weather variant index if it changes mid-race (optional; mostly static). */
  surfaceVariant?: number;
}

/* ──────────────────────────── background ──────────────────────────────────────
 * RoadRender_BitmapLine.Render() draws a parallax "bg" clip + solid sky/ground bands
 * behind the road (lines 58-89). */
export interface BackgroundState {
  /** "bg" clip + 0-based frame (GameVars.currentBackgroundFrame-1). */
  clip: string;
  frame: number;
  /** Horizontal parallax offset (GameVars.playerRot). */
  parallaxX: number;
  /** Vertical placement (playeryBackgroundYpos + horizonY + clip yOffset). */
  yPos: number;
  /** Sky / ground solid-fill colours (ARGB) for the bands above/below the bg bitmap. */
  skyColor: number;
  groundColor: number;
}

/* ──────────────────────────── post-process ────────────────────────────────────
 * Full-screen pass when copying the scene buffer to the display (Game.as:2437-2451). */
export interface ScreenPost {
  /** Screen tilt + shake rotation, radians (Dash.GetScreenTilt + screenShakeRot). */
  tiltRot: number;
  shakeX: number;
  shakeY: number;
  /** Extra zoom on top of the fixed 1.1x (screenShakeScale). */
  shakeScale: number;
  steadyCamX: number;
  steadyCamY: number;
  /** Full-screen ColorTransform when turbo/nitro is active (nitro_blur_* vars, 2449). */
  turboCT?: ColorTransformLike;
}

/* ──────────────────────────────── the frame ───────────────────────────────────*/
export interface RenderFrame {
  background: BackgroundState;
  road: RoadState;
  /** is3DObject gameplay objects in TRACK coords; renderer perspective-projects + depth-
   *  sorts them with the road segments (one pass). */
  objects3D: Object3D[];
  /** Screen-space overlays/HUD (dash, lensflare, particles already-projected, panel). */
  overlays: OverlayObj[];
  /** Full-screen post; omit for no shake/tilt/turbo. */
  post?: ScreenPost;
  stage: { width: 640; height: 480 };
}

/** Game-internal 2D camera (used to bake overlay screen coords). NOT part of RenderFrame —
 *  the 3D camera is RoadState; overlays arrive pre-baked. */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}
