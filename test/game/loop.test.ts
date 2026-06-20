// Integration test for the game loop spine, driven against the REAL bit-exact engine.
// Not a physics golden — it verifies the framework wiring: the fixed 2×(1/80) cadence,
// the physics→GameObj write-back over world.GetBodyList(), kill/add lists, and the
// RenderFrame emission (camera baked in, active&&visible only). Uses shapeless bodies
// (the m0/m1 path) so it touches no unported engine code.
import { describe, it, expect } from "vitest";
import { Game } from "../../src/game/game";
import { GameObj } from "../../src/game/model/game-obj";
import { GameObjects } from "../../src/game/model/game-objects";
import { PhysObjBodyUserData } from "../../src/game/model/body-user-data";
import { PhysicsBase } from "../../src/game/physics-base";
import { b2BodyDef } from "../../src/box2d/Dynamics/b2BodyDef";
import type { b2World } from "../../src/box2d/Dynamics/b2World";

// Spawn a shapeless dynamic body at world (wx,wy) linked to a GameObj at the given index.
function spawnFallingGO(game: Game, idx: number, wx: number, wy: number): GameObj {
  const go = new GameObj();
  go.clip = "TestSprite";
  go.layer = "foreground";
  go.zpos = 5;

  const ud = new PhysObjBodyUserData();
  ud.gameObjectIndex = idx;
  const bd = new b2BodyDef();
  bd.position.Set(wx, wy);
  bd.massData.mass = 1;
  bd.massData.I = 1;
  bd.userData = ud;
  const body = (game.physics.world as b2World).CreateBody(bd)!;
  go.body = body;
  go.updateFromPhysicsFunction = (g, b) => GameObjects.writebackFromBody(g, b);
  return go;
}

describe("game loop spine", () => {
  it("constants mirror PhysicsBase.as exactly", () => {
    expect(PhysicsBase.p2w).toBe(20);
    expect(PhysicsBase.w2p).toBe(0.05);
    expect(PhysicsBase.physGravity).toBe(20);
    expect(PhysicsBase.physStep).toBe(1 / 80);
    expect(PhysicsBase.physNumIterations).toBe(10);
  });

  it("steps physics and writes body transform back to the GameObj (in pixels)", () => {
    const game = new Game();
    game.init();
    const go = spawnFallingGO(game, 0, 10, 0); // world x=10 → xpos = 200px
    game.gameObjects.add(go); // index 0 (matches userData)

    for (let i = 0; i < 30; i++) game.updateGameplay();

    // gravity is +y (down); the body fell, so ypos increased from 0.
    expect(go.ypos).toBeGreaterThan(0);
    // x unchanged → xpos = world 10 × p2w 20 = 200.
    expect(go.xpos).toBeCloseTo(200, 6);
    // two substeps per frame → 60 sim steps after 30 frames.
    expect(game.frameCount).toBe(30);
  });

  it("emits a RenderFrame with camera baked in, active&&visible only", () => {
    const game = new Game();
    game.init();
    const a = spawnFallingGO(game, 0, 10, 0);
    const b = spawnFallingGO(game, 1, -5, 0);
    game.gameObjects.add(a);
    game.gameObjects.add(b);
    b.visible = false; // should be excluded
    game.camera = { x: 100, y: 0, scale: 1 };

    const frame = game.tick();
    expect(frame.stage).toEqual({ width: 640, height: 480 });
    expect(frame.objects).toHaveLength(1); // b is invisible
    expect(frame.objects[0].clip).toBe("TestSprite");
    expect(frame.objects[0].x).toBeCloseTo(a.xpos - 100, 6); // camera subtracted
    expect(frame.objects[0].zpos).toBe(5);
  });

  it("killObjects deactivates + calls removeFunction; object leaves the RenderFrame", () => {
    const game = new Game();
    game.init();
    let removed = false;
    const go = spawnFallingGO(game, 0, 0, 0);
    go.removeFunction = () => {
      removed = true;
    };
    game.gameObjects.add(go);

    go.kill(); // flag for removal
    game.tick(); // kill happens inside updateGameplay
    expect(go.active).toBe(false);
    expect(removed).toBe(true);
    expect(game.render().objects).toHaveLength(0);
  });

  it("addList: a spawn requested during update is drained the same frame (after update)", () => {
    const game = new Game();
    game.init();
    const spawner = spawnFallingGO(game, 0, 0, 0);
    const child = spawnFallingGO(game, 1, 0, 0);
    let spawned = false;
    spawner.updateFunction = () => {
      game.gameObjects.addToAddList(() => {
        game.gameObjects.add(child);
        spawned = true;
      }, null);
    };
    game.gameObjects.add(spawner);

    game.updateGameplay(); // update queues, doAddList drains
    expect(spawned).toBe(true);
    expect(game.gameObjects.objs).toContain(child);
  });
});
