// The entity manager: the pool, the add/kill lists, the per-frame update, the physics
// write-back, and RenderFrame emission. Cite: GameObjects.as (Update / KillObjects /
// DoAddList / ClearAddList / UpdateGOsFromPhysics / Render). The per-frame ORDER is
// owned by Game (Game.UpdateGameplay_Garage) — see game.ts.
import type { b2World } from "../../box2d/Dynamics/b2World";
import { GameObj } from "./game-obj";
import { PhysObjBodyUserData } from "./body-user-data";
import { PhysicsBase } from "../physics-base";
import type { RenderFrame, RenderObj, Camera } from "../../../contracts/render-state";

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

  /** GameObjects.UpdateGOsFromPhysics — walk world.GetBodyList(), map each body to its
   *  GameObj via PhysObjBodyUserData.gameObjectIndex, and run its per-type writeback
   *  (which sets xpos/ypos = body world × p2w, dir = body angle). */
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

  /** Build the RenderFrame the renderer draws: active && visible objects, with the
   *  camera baked into screen coords (xpos − camera.x — RenderDispObjNormally).
   *  ⚠ PROVISIONAL (RenderFrame v1): render's Game.Render audit found mspr is pseudo-3D —
   *  most objects are TRACK-space (xpos lateral + zpos along-track + is3DObject), drawn by
   *  RoadRender's perspective depth-pass, not flat screen layers. This emission is replaced
   *  in the RenderFrame-v2 / RoadState co-design with render. The spine above (cadence,
   *  writeback, kill/add) is unaffected; only this output shape changes. */
  emitRenderFrame(camera: Camera, road: RenderFrame["road"]): RenderFrame {
    const objects: RenderObj[] = [];
    for (const go of this.objs) {
      if (!go.active || !go.visible) continue;
      objects.push({
        clip: go.clip,
        frame: go.frame,
        x: go.xpos - camera.x,
        y: go.ypos - camera.y,
        dir: go.dir,
        scale: go.scale,
        xflip: go.xflip,
        layer: go.layer,
        zpos: go.zpos,
        alpha: go.alpha,
        colorTransform: go.colorTransform,
        smooth: go.smooth,
        blend: go.blend,
      });
    }
    return { objects, road, camera, stage: { width: 640, height: 480 } };
  }

  /** Convenience: write a body's transform to a GameObj in pixels (the common writeback). */
  static writebackFromBody(go: GameObj, body: import("../../box2d/Dynamics/b2Body").b2Body): void {
    const p = body.GetPosition();
    go.xpos = p.x * PhysicsBase.p2w;
    go.ypos = p.y * PhysicsBase.p2w;
    go.dir = body.GetAngle();
  }
}
