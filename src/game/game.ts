// The world/state owner + the fixed-step loop. Cite: Game.as (UpdateGameplay /
// UpdateGameplay_Garage). The per-frame ORDER is load-bearing for determinism — it is
// reproduced EXACTLY from Game.as:2232-2238:
//     2× world.Step → updateGOsFromPhysics → clearAddList → update → killObjects → doAddList
// Our fixed 2×(1/80) loop owns determinism; the renderer reads the emitted RenderFrame
// and never drives the sim.
import { PhysicsBase } from "./physics-base";
import { GameObjects } from "./model/game-objects";
import type { Camera, RenderFrame, RoadState } from "../../contracts/render-state";
import type { Level } from "./data/levels";

export class Game {
  physics = new PhysicsBase();
  gameObjects = new GameObjects();
  camera: Camera = { x: 0, y: 0, scale: 1 };
  level: Level | null = null;
  frameCount = 0;

  init(): void {
    this.physics.initBox2D();
  }

  loadLevel(level: Level): void {
    this.level = level;
    // m6: instantiate the level's physobjs via physics.addPhysObjAt(...) and register a
    // GameObj per instance. Until joints land, the level is loaded as data only.
  }

  /** One gameplay update — the faithful cadence (Game.as:2232-2238). */
  updateGameplay(): void {
    this.physics.step(); // 2× world.Step(1/80, 10)
    this.gameObjects.updateGOsFromPhysics(this.physics.world);
    this.gameObjects.clearAddList();
    this.gameObjects.update();
    this.gameObjects.killObjects();
    this.gameObjects.doAddList();
    this.frameCount++;
  }

  /** Advance one frame and produce what the renderer draws. */
  tick(): RenderFrame {
    this.updateGameplay();
    return this.render();
  }

  /** Build the RenderFrame from current state (no sim mutation). */
  render(): RenderFrame {
    // RoadState placeholder — co-designed with render when RoadRender lands.
    const road: RoadState = { cameraZ: 0, cameraX: 0 };
    return this.gameObjects.emitRenderFrame(this.camera, road);
  }
}
