// The entity manager: the pool, the add/kill lists, the per-frame update, the physics
// write-back, and RenderFrame emission. Cite: GameObjects.as (Update / KillObjects /
// DoAddList / ClearAddList / UpdateGOsFromPhysics / Render). The per-frame ORDER is
// owned by Game (Game.UpdateGameplay_Garage) — see game.ts.
import type { b2World } from "../../box2d/Dynamics/b2World";
import { GameObj } from "./game-obj";
import { PhysObjBodyUserData } from "./body-user-data";
import { PhysicsBase } from "../physics-base";
import type {
  RenderFrame,
  Object3D,
  OverlayObj,
  RoadState,
  BackgroundState,
  ScreenPost,
} from "../../../contracts/render-state";

type AddEntry = { fn: (o: unknown) => void; o: unknown };

export class GameObjects {
  /** The pool. Indices are STABLE (referenced by PhysObjBodyUserData.gameObjectIndex):
   *  killed objects are deactivated in place, not spliced out.
   *  TODO(pooling): reuse inactive slots via an inactiveIndices stack like the AS3. */
  objs: GameObj[] = [];
  private addList: AddEntry[] = [];

  add(go: GameObj): GameObj {
    go.index = this.objs.length;
    this.objs.push(go);
    go.active = true;
    return go;
  }

  // ---- add list (deferred spawns; drained after Update so we don't mutate mid-iterate) ----
  clearAddList(): void {
    this.addList = [];
  }
  addToAddList(fn: (o: unknown) => void, o: unknown): void {
    this.addList.push({ fn, o });
  }
  doAddList(): void {
    for (const e of this.addList) e.fn(e.o);
  }

  /** GameObjects.Update — tick every active object's behaviour. */
  update(): void {
    for (const go of this.objs) if (go.active) go.update();
  }

  /** GameObjects.KillObjects — deactivate killed objects, then call their removeFunction. */
  killObjects(): void {
    const killed: GameObj[] = [];
    for (const go of this.objs) {
      if (go.active && go.killed) {
        go.active = false;
        killed.push(go);
      }
    }
    for (const go of killed) go.removeFunction?.(go);
  }

  /** ⚠ VESTIGIAL (physobj-prop path only). Cars are arcade and set xpos/ypos/zpos themselves
   *  in their update function — they have NO Box2D body. This readback is called in the shipped
   *  game ONLY by the dead garage loop (Game.UpdateGameplay_Garage), so the RACE loop never runs
   *  it. Kept for the unused physobj path + the live Box2D demo. Cite: GameObjects.UpdateGOsFromPhysics.
   *  Walk world.GetBodyList(), map each body→GameObj via gameObjectIndex, run its writeback. */
  updateGOsFromPhysics(world: b2World): void {
    let b = world.GetBodyList();
    while (b) {
      const ud = b.GetUserData() as PhysObjBodyUserData | null;
      if (ud && ud.gameObjectIndex !== -1) {
        const go = this.objs[ud.gameObjectIndex];
        if (go && go.updateFromPhysicsFunction) go.updateFromPhysicsFunction(go, b);
      }
      b = b.GetNext();
    }
  }

  /** Build the RenderFrame v2 (LOCKED contract): split active && visible GameObjs by
   *  is3DObject into the TRACK-space objects3D list (RoadRender perspective-projects +
   *  depth-sorts them with the road segments) and the SCREEN-space overlays list.
   *  background / road camera / post come from the game (Game.render). Particles / Dash /
   *  Lensflare are SEPARATE overlay sources (not GameObjs) added by the renderer or fed
   *  later. Cite: RoadRender.AddGameObjects (is3DObject discriminator) + Game.Render. */
  emitRenderFrame(road: RoadState, background: BackgroundState, post?: ScreenPost): RenderFrame {
    const objects3D: Object3D[] = [];
    const overlays: OverlayObj[] = [];
    for (const go of this.objs) {
      if (!go.active || !go.visible) continue;
      if (go.is3DObject) {
        objects3D.push({
          clip: go.clip,
          frame: go.frame,
          xpos: go.xpos, // lateral
          zpos: go.zpos, // along-track
          ypos: go.ypos, // height above road
          dir: go.dir,
          scale: go.scale,
          xflip: go.xflip,
          useLapForRender: go.useLapForRender,
          useAbsoluteYpos: go.useAbsoluteYpos,
          colorTransform: go.colorTransform,
          smooth: go.smooth,
          blend: go.blend,
        });
      } else {
        overlays.push({
          clip: go.clip,
          frame: go.frame,
          x: go.xpos, // screen px (camera baked game-side)
          y: go.ypos,
          dir: go.dir,
          scale: go.scale,
          xflip: go.xflip,
          colorTransform: go.colorTransform,
          smooth: go.smooth,
          blend: go.blend,
          afterPost: go.afterPost,
        });
      }
    }
    return { background, road, objects3D, overlays, post, stage: { width: 640, height: 480 } };
  }

  /** Convenience: write a body's transform to a GameObj in pixels (the common writeback). */
  static writebackFromBody(go: GameObj, body: import("../../box2d/Dynamics/b2Body").b2Body): void {
    const p = body.GetPosition();
    go.xpos = p.x * PhysicsBase.p2w;
    go.ypos = p.y * PhysicsBase.p2w;
    go.dir = body.GetAngle();
  }
}
