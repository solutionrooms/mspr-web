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

/** The compositor layers, back-to-front. Names mirror Game.as's BitmapData layers;
 *  confirm the exact set + order against Game.Render. */
export type RenderLayer =
  | "background"
  | "scroll"
  | "shadow"
  | "road"
  | "particle"
  | "foreground"
  | "hud";

/** Flash blend modes used by DisplayObjFrame (RenderAtRotScaled* variants).
 *  'normal' = alpha-over, 'add' = additive. 'layer'/'overlay' have no direct WebGL
 *  blendFunc — render dev implements them shader-side (see RENDER_DEV.md). */
export type BlendMode = "normal" | "add" | "layer" | "overlay";

export interface RenderObj {
  /** Sprite/symbol identity in the asset atlas. OPEN: keyed by the SWF linkage/clip
   *  name (physobjs[].graphics[].clip, billboard.mc, etc.); render dev confirms the
   *  atlas key once the asset pipeline lands. */
  clip: string;
  /** 0-based timeline frame within the clip. */
  frame: number;
  /** Screen-space position (px), camera already applied. */
  x: number;
  y: number;
  /** Registration/anchor offset within the sprite (px), applied before rotate/scale. */
  xoff: number;
  yoff: number;
  /** Rotation in RADIANS. */
  dir: number;
  /** Uniform scale (or per-axis if needed for the road — confirm). */
  scale: number;
  /** Horizontal flip. */
  xflip: boolean;
  /** Which compositor layer this draws into. */
  layer: RenderLayer;
  /** Draw-order key within the layer. */
  zpos: number;
  /** 0..1 (equals colorTransform.alphaMultiplier when a CT is present). */
  alpha: number;
  /** Optional full recolour (mult + offset — the software path uses both). */
  colorTransform?: ColorTransformLike;
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
