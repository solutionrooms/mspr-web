// A game entity. Mirrors GameObj_Base's render-relevant state (xpos/ypos in PIXELS,
// dir radians, frame 0-based, zpos draw-order) and the physics link. Per-object-type
// BEHAVIOUR is supplied via the *Function hooks — the AS3 init functions register an
// update / updateFromPhysics / remove function per object kind (e.g. a car, a pickup);
// the framework just invokes them. Cite: GameObj_Base.as (fields + Update()).
import type { b2Body } from "../../box2d/Dynamics/b2Body";
import type { ColorTransformLike, RenderLayer, BlendMode } from "../../../contracts/render-state";

export type UpdateFn = (go: GameObj) => void;
export type UpdateFromPhysicsFn = (go: GameObj, body: b2Body) => void;
export type RemoveFn = (go: GameObj) => void;

export class GameObj {
  /** Stable index into GameObjects.objs (referenced by PhysObjBodyUserData). */
  index = -1;
  active = false;
  visible = true;
  killed = false;

  // Transform — world position in PIXELS (= body world units × p2w), set by the
  // updateFromPhysics writeback. The renderer applies the camera (xpos − camera.x).
  xpos = 0;
  ypos = 0;
  dir = 0; // radians (= body angle)
  scale = 1;
  frame = 0; // 0-based timeline frame
  zpos = 0; // draw-order key within a layer

  // Render attributes (consumed when building the RenderFrame).
  xflip = false;
  alpha = 1;
  clip = ""; // DisplayObj linkage / atlas key
  layer: RenderLayer = "foreground";
  colorTransform?: ColorTransformLike;
  blend?: BlendMode;
  smooth = false; // renderSmooth — NEAREST when false (the default)

  /** Track-space object: drawn by RoadRender's perspective depth-pass (xpos = lateral,
   *  zpos = along-track distance), NOT as a flat screen-space sprite. Cite:
   *  GameObj_Base.is3DObject / RoadRender.AddGameObjects (render's Game.Render audit).
   *  Drives the RenderFrame-v2 split (3D-object list vs screen overlays) — see
   *  DEVELOPER_MESSAGES "road renderer IS the sprite compositor". */
  is3DObject = false;

  /** The Box2D body driving this object, if any (null for pure-graphic objects). */
  body: b2Body | null = null;

  updateFunction: UpdateFn | null = null; // GameObj_Base.updateFunction
  updateFromPhysicsFunction: UpdateFromPhysicsFn | null = null;
  removeFunction: RemoveFn | null = null;

  /** GameObj_Base.Update() — invoke the per-type behaviour. */
  update(): void {
    this.updateFunction?.(this);
  }

  /** Flag for removal; KillObjects deactivates + calls removeFunction next frame. */
  kill(): void {
    this.killed = true;
  }
}
