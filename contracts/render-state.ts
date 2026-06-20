/**
 * mspr render-state contract  (game → render)  — v1 (provisional; render dev refines)
 * Owner: game developer. Derived from DisplayObjFrame.as (RenderAtRotScaled* paths),
 * Game.as (Render + the layer composite), Camera.as, and the road renderer
 * (EditorPackage/RoadEditor/Road.as → RoadRender).
 *
 * SEPARATION OF CONCERNS
 *   The game dev produces one `RenderFrame` per displayed frame from game state. The
 *   render dev consumes it and draws with a custom WebGL2 2D compositor. Rendering is
 *   NOT bound by the Prime Directive (visual, not physics) — but match these
 *   conventions so it looks identical to the original.
 *
 * ⚠ THE RENDERING REALITY (read CLAUDE.md "The rendering reality" first)
 *   The shipped game renders in SOFTWARE: Game.Render composites ~7 BitmapData layers
 *   (background / scroll / shadow / road / particle / foreground / hud), and each
 *   sprite is blitted by DisplayObjFrame.RenderAtRotScaled* with a registration
 *   offset, rotation, scale, x-flip, full ColorTransform, and a blend mode. The Stage3D
 *   `s3d` batcher is DEAD CODE in the shipped SWF — use it only as the design
 *   reference for the WebGL batcher, NOT as the source of visual semantics.
 *
 * COORDINATE / TRANSFORM CONVENTIONS  (must match the AS3 exactly)
 *   - Stage is 640×480 (Defs.displayarea_w/h), origin top-left, y-DOWN.
 *   - World→screen: the camera offset is baked in on the CPU (Camera.x/y subtracted
 *     from world coords) — the renderer receives screen-space pixel coords. Confirm
 *     pixel-snapping (round()) against GameObj/DisplayObjFrame before relying on it.
 *   - dir is RADIANS. frame is 0-BASED (the timeline frame is frame+1).
 *   - xoff/yoff are the sprite's registration/anchor offset (see caroffsets.json for
 *     cars; DisplayObjFrame.xoffset/yoffset otherwise) — applied before rotate/scale.
 *   - Draw order: per-layer, then by zpos within a layer. Confirm sort direction
 *     against Game.Render / GameObjects ordering.
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

/** ⚠ UNDER REVISION (RenderFrame v2 — see DEVELOPER_MESSAGES "road renderer IS the sprite
 *  compositor"). Render's Game.Render audit found mspr is pseudo-3D: most objects are
 *  TRACK-space and drawn by RoadRender's perspective depth-pass interleaved with road
 *  segments — NOT a back-to-front composite of flat named layers. This 7-value enum +
 *  "group by layer, sort by zpos" holds only for the true overlays/HUD. The 3D-object vs
 *  overlay split + RoadState are ONE design, co-designed with render before RoadRender lands.
 *  The compositor layers, back-to-front (legacy v1 model): */
export type RenderLayer =
  | "background"
  | "scroll"
  | "shadow"
  | "road"
  | "particle"
  | "foreground"
  | "hud";

/** Flash blend modes used by DisplayObjFrame (RenderAtRotScaled* variants).
 *  'normal' = alpha-over (the whole GameObj_Base render path), 'add' = additive
 *  (effects/particles). 'layer'/'overlay' are kept in the union for completeness but
 *  have NO active callers in the shipped game's render path and no data config selecting
 *  them (verified: GameObj_Base uses only RenderAtRotScaled[_Xflip]; the Layer/Overlay
 *  wrappers in DisplayObj.as are dead pass-throughs). DEPRIORITISE them — build
 *  normal+add first; flag if a real caller ever surfaces. (Answer to render Q#4.) */
export type BlendMode = "normal" | "add" | "layer" | "overlay";

/**
 * A car is NOT one sprite — it renders as a STACK of DisplayObj layers
 * (car_dobj_layer0 / _shadow / _1 / _color / _2 / _headlights; GameObj.as:1241-1260),
 * with the per-player recolour `carCT = ColorTransform(1,1,1,1, r-255,g-255,b-255, 0)`
 * applied ONLY to the `_color` layer (GameObj.as:3246) and a fixed
 * `shadowCT(1,1,1,1, -255,-255,-255,-128)` on `_shadow`. CONFIRMED: the game emits ONE
 * RenderObj per layer (each its own `clip` + `colorTransform` + `zpos`); the renderer
 * just draws the list. Render owns adding the `car_dobj_layer_*` clips to the atlas.
 */
export interface RenderObj {
  /** Sprite/symbol identity in the asset atlas = the SWF SymbolClass/linkage name
   *  (CONFIRMED: matches physobjs[].graphics[].clip, roaddata billboard `.mc`,
   *  caroffsets[].mcname). For cars, the per-layer clip (e.g. `car_dobj_layer_color`). */
  clip: string;
  /** 0-based timeline frame within the clip. */
  frame: number;
  /** Screen-space position (px), camera already applied. */
  x: number;
  y: number;
  /** Registration/anchor offset (px), applied before rotate/scale. OPTIONAL: the atlas
   *  owns pivots per (clip,frame) — omit and the renderer uses the atlas pivot (cars:
   *  caroffsets (xoff,yoff); others: DefineSprite registration). Only set to OVERRIDE. */
  xoff?: number;
  yoff?: number;
  /** Rotation in RADIANS. */
  dir: number;
  /** Uniform scale. */
  scale: number;
  /** Horizontal flip (negates X AFTER rotation — RenderAtRotScaled_Xflip). */
  xflip: boolean;
  /** Which compositor layer this draws into. */
  layer: RenderLayer;
  /** Draw-order key within the layer. */
  zpos: number;
  /** 0..1 (equals colorTransform.alphaMultiplier when a CT is present). */
  alpha: number;
  /** Full recolour (mult + offset). IGNORED when blend==='add' — the additive path
   *  passes CT=null (DisplayObjFrame.as:346), so the game must not rely on tint+add. */
  colorTransform?: ColorTransformLike;
  /** NEAREST (false, the default — GameObj_Base.renderSmooth=false) vs LINEAR sampling;
   *  per-object (DisplayObjFrame param7). (Added per render Q#3.) */
  smooth?: boolean;
  /** Default 'normal'. */
  blend?: BlendMode;
}

/**
 * The pseudo-3D road is NOT sprite-based — it is a procedural segment renderer
 * (RoadRender) that projects the road layout (data/levels.json `road.blocks` +
 * data/roaddata.json surfaces/edges + data/vars.json road_* constants) into screen
 * strips. The render dev reproduces RoadRender; the game dev supplies the camera-
 * along-track state it needs. This shape is a placeholder — co-design before building.
 */
export interface RoadState {
  /** Distance of the camera along the track (world Z). */
  cameraZ: number;
  /** Player/camera lateral offset and look direction (curve accumulation). */
  cameraX: number;
  /** OPEN: the render dev will pull most road geometry directly from the level +
   *  roaddata + vars; this carries only the per-frame camera/dynamic state. */
  [k: string]: unknown;
}

export interface Camera {
  /** World-space top-left the 2D camera is scrolled to (px). */
  x: number;
  y: number;
  /** Zoom; usually 1. */
  scale: number;
}

export interface RenderFrame {
  /** Active && visible sprite objects. Render groups by `layer`, then sorts by zpos. */
  objects: RenderObj[];
  /** Procedural road layer state (drawn into the 'road' layer). */
  road: RoadState;
  camera: Camera;
  /** Fixed stage; letterbox into the window. */
  stage: { width: 640; height: 480 };
}
