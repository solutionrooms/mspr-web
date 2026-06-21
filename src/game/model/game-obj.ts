// A game entity. Mirrors GameObj_Base's render-relevant state (xpos/ypos in PIXELS,
// dir radians, frame 0-based, zpos draw-order) and the physics link. Per-object-type
// BEHAVIOUR is supplied via the *Function hooks — the AS3 init functions register an
// update / updateFromPhysics / remove function per object kind (e.g. a car, a pickup);
// the framework just invokes them. Cite: GameObj_Base.as (fields + Update()).
import type { b2Body } from "../../box2d/Dynamics/b2Body";
import type { ColorTransformLike, BlendMode } from "../../../contracts/render-state";

export type UpdateFn = (go: GameObj) => void;
export type UpdateFromPhysicsFn = (go: GameObj, body: b2Body) => void;
export type RemoveFn = (go: GameObj) => void;

export class GameObj {
  /** Stable index into GameObjects.objs (referenced by PhysObjBodyUserData). */
  index = -1;
  active = false;
  visible = true;
  killed = false;

  // Transform. Interpretation depends on is3DObject (matches GameObj_Base / RenderFrame v2):
  //   is3DObject → xpos = LATERAL offset, zpos = ALONG-TRACK distance, ypos = HEIGHT above road
  //   overlay    → xpos/ypos = SCREEN pixels (camera baked by the game), zpos = draw order
  // Set by the per-type updateFromPhysics writeback (body world units × p2w).
  xpos = 0;
  ypos = 0;
  zpos = 0;
  dir = 0; // radians (heading)
  scale = 1;
  frame = 0; // 0-based timeline frame

  // Arcade integrator state (track-space velocities + last-frame history). The car update
  // integrates these itself each frame (zpos += zvel, …) — there is NO Box2D body. Collision
  // resolution reads oldxpos/oldzpos. Cite: GameObj_Base.as (xvel/yvel/zvel/oldxpos/oldzpos).
  xvel = 0;
  yvel = 0;
  zvel = 0;
  oldxpos = 0;
  oldzpos = 0;
  turboVel = 0; // added to zpos alongside zvel (turbo/nitro), GameObj.as:1452

  // Render attributes (consumed when building the RenderFrame).
  xflip = false;
  name = ""; // GameObj_Base.name — object kind id ("player", "decal", …); used by gameplay logic
  clip = ""; // DisplayObj linkage / atlas key
  colorTransform?: ColorTransformLike;
  blend?: BlendMode;
  smooth = false; // renderSmooth — NEAREST when false (the default)

  // Player follow-camera offsets (player car only). The road camera = raw (xpos,ypos,zpos)
  // plus these, per PlayerUpdateCameraAfterCollision (GameObj.as:1657-1659); they ease in/out
  // on respawn/collision (UpdatePlayerWaitingToRespawn, GetNormalCamOffset*). Cite: GameObj.as.
  playerCamOffsetX = 0;
  playerCamOffsetY = 0;
  playerCamOffsetZ = 0;

  // RoadRender placement flags (3D objects):
  useLapForRender = false; // zpos wraps modulo lap length (RoadRender.AddGameObjects:731)
  useAbsoluteYpos = false; // ypos is absolute screen Y, not road-relative
  // Overlay routing: draw in the HUD pass (after post-process) vs the pre-post overlay pass.
  afterPost = false;

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
