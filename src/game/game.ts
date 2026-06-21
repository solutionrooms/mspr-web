// The world/state owner + the fixed-step loop.
//
// ⚠ PHYSICS MODEL (corrected 2026-06-21 — see DEVELOPER_MESSAGES "Box2D is dead in the ship"):
// mspr's gameplay is a PURE ARCADE pseudo-3D racer. The car integrator is hand-rolled in
// track-space (`zpos += zvel`, lateral `xpos`, height `ypos`) in GameObj.UpdatePlayer
// (GameObj.as:1994) and resolved by arcade collision (CarCollision / Collision). Box2D is
// VESTIGIAL: `b2World.Step` is called only in `Game.UpdateGameplay_Garage` (Game.as:2232-2233),
// which has ZERO callers; the shipped tick is `Main.RunLevel → Game.UpdateGameplay` (the RACE
// loop, Game.as:1998), which NEVER steps the world. So the bit-exact Prime Directive targets the
// ARCADE engine, not Box2D. Box2D stays vendored only for FZ3 parity.
//
// The per-frame ORDER below is reproduced from the RACE loop Game.UpdateGameplay (Game.as:1998):
//   UpdateControl → [ Update → KillObjects → DoAddList → Particles → race-positions →
//                     CarCollision → camera-follow → steady-cam ]   (no world.Step)
// Our fixed loop owns determinism; the renderer reads the emitted RenderFrame and never drives it.
import { PhysicsBase } from "./physics-base";
import { GameObjects } from "./model/game-objects";
import { GameObj } from "./model/game-obj";
import { updatePlayerCoast } from "./arcade/update-player";
import type { Camera, RenderFrame, RoadState, BackgroundState } from "../../contracts/render-state";
import type { Level } from "./data/levels";

export class Game {
  /** Vestigial Box2D world (created, never stepped in the race loop — kept for FZ3 parity and
   *  the unused physobj-prop path). The arcade engine owns gameplay + determinism. */
  physics = new PhysicsBase();
  gameObjects = new GameObjects();
  /** Game-internal 2D camera (the legacy `Camera`; mostly unused in the pseudo-3D path). */
  camera: Camera = { x: 0, y: 0, scale: 1 };
  /** The player car (arcade GameObj). The follow camera reads its raw track coords. */
  player: GameObj | null = null;
  level: Level | null = null;
  frameCount = 0;

  init(): void {
    // Box2D is still initialised (vendored engine, used by the live demo + the vestigial
    // physobj path), but the gameplay loop does NOT step it. See header.
    this.physics.initBox2D();
  }

  loadLevel(level: Level): void {
    this.level = level;
    // Arcade level load: instantiate cars + track objects as GameObjs with their per-type
    // arcade update functions (NOT Box2D bodies). Set `this.player` to the player car.
  }

  /** Spawn the player car. Minimal faithful form of the shipped spawn
   *  (RaceEventDay.as:739-741: `AddObj(0,0,startZ)` → `InitPlayer()` → `ClearRollingStart()`) —
   *  the a0 subset, grown as the a-ladder lands. Initial position comes from `AddObj(xpos,ypos,zpos)`;
   *  the rest from `GameObj.InitPlayer` (GameObj.as:3174): `name="player"`, `is3DObject`,
   *  `useLapForRender`, `dir=0`, `zvel=0`, cam offsets `0`, `oldzpos=zpos`. The per-frame behaviour
   *  is the bit-exact ARCADE integrator (`src/game/arcade`, engine-owned); a0 wires the coast branch
   *  (`updatePlayerCoast` = `UpdatePlayer`'s `isKnockedOut` roll). GameObj structurally IS the
   *  integrator's `ArcadeCarState`. */
  spawnPlayer(startZ: number): GameObj {
    const go = new GameObj();
    go.name = "player"; // InitPlayer:3214
    go.xpos = 0; // AddObj(0, …)
    go.ypos = 0; // AddObj(…, 0, …)
    go.zpos = startZ; // AddObj(…, …, startZ)
    go.oldzpos = startZ; // InitPlayer:3251 oldzpos = zpos
    go.dir = 0; // InitPlayer:3205
    go.zvel = 0; // InitPlayer:3227
    go.is3DObject = true; // InitPlayer:3229
    go.useLapForRender = true; // InitPlayer:3199
    // playerCamOffsetX/Y/Z default 0 (InitPlayer:3215-3217).
    go.updateFunction = (g) => updatePlayerCoast(g); // a0 seam → arcade engine
    this.gameObjects.add(go);
    this.player = go;
    return go;
  }

  /** UpdateControl() (Game.as:2154) — sample input into per-car control state. Stub until the
   *  player/AI car update lands; the arcade integrator consumes this in GameObj.update(). */
  private updateControl(): void {
    // TODO: KeyReader → control flags (downL/downR/throttle) on the player + AI inputs.
  }

  /** CarCollision.CarCarCollision + PlayerOvertakeCollision (Game.as:2181-2182) — arcade
   *  push-apart in track-space (xpos/zpos, NOT Box2D). Stub until CarCollision is ported. */
  private carCollision(): void {
    // TODO: port CarCollision (operates on go.xpos/zpos/collisionDX/DZ).
  }

  /** One gameplay update — the faithful RACE cadence (Game.UpdateGameplay, Game.as:1998).
   *  NB: no world.Step — that lives only in the dead garage loop. */
  updateGameplay(): void {
    this.updateControl(); // UpdateControl() (2154)
    // --- the GameObjects pass (2162-2166) ---
    this.gameObjects.clearAddList();
    this.gameObjects.update(); // each car integrates itself (zpos += zvel, steering, …)
    this.gameObjects.killObjects();
    this.gameObjects.doAddList();
    // this.particles.update();         // Particles.Update() (2166) — TODO
    // race positions / normal+rolling start (2176-2179) — TODO
    this.carCollision(); // CarCollision (2181-2182)
    // hud / weather (2186-2188) — TODO
    this.updatePlayerCamera(); // goPlayer.PlayerUpdateCameraAfterCollision (2190)
    // this.updateSteadyCam(player.zvel) // (2191) — TODO
    this.frameCount++;
  }

  /** Advance one frame and produce what the renderer draws. */
  tick(): RenderFrame {
    this.updateGameplay();
    return this.render();
  }

  /** PlayerUpdateCameraAfterCollision (GameObj.as:1657-1659): the road camera follows the
   *  player car's RAW arcade track coords (NOT pixels). Render negates lateral internally.
   *      camera.x = xpos + playerCamOffsetX                 (lateral)
   *      camera.y = -(ypos * 0.7) + playerCamOffsetY        (height)
   *      camera.z = zpos + playerCamOffsetZ                 (distance along track)
   *  Held on the Game so render() can emit it; neutral (0,0,0) until a player exists. */
  roadCamera: RoadState = { cameraX: 0, cameraY: 0, cameraZ: 0 };

  private updatePlayerCamera(): void {
    const p = this.player;
    if (!p) return;
    this.roadCamera = {
      cameraX: p.xpos + p.playerCamOffsetX,
      cameraY: -(p.ypos * 0.7) + p.playerCamOffsetY,
      cameraZ: p.zpos + p.playerCamOffsetZ,
    };
  }

  /** Build the RenderFrame v2 from current state (no sim mutation). The road camera is the
   *  follow camera computed in updatePlayerCamera. Background + post stay neutral placeholders
   *  until those gameplay systems (parallax bg, shake/tilt/turbo) land. */
  render(): RenderFrame {
    const background: BackgroundState = {
      clip: "",
      frame: 0,
      parallaxX: 0,
      yPos: 0,
      skyColor: 0,
      groundColor: 0,
    };
    return this.gameObjects.emitRenderFrame(this.roadCamera, background);
  }
}
