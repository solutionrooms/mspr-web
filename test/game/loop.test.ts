// Integration test for the ARCADE game-loop spine (Game.UpdateGameplay, Game.as:1998).
// Not a physics golden — it verifies the framework wiring: the faithful race order
// (UpdateControl → Update → KillObjects → DoAddList → CarCollision → camera-follow), the
// arcade self-integration (a car advances its own zpos/xpos — NO Box2D), the kill/add lists,
// the follow camera, and the RenderFrame v2 emission. mspr's gameplay never steps Box2D
// (world.Step lives only in the dead garage loop), so nothing here touches the engine.
import { describe, it, expect } from "vitest";
import { Game } from "../../src/game/game";
import { GameObj } from "../../src/game/model/game-obj";
import { PhysicsBase } from "../../src/game/physics-base";

// An arcade car: it integrates its own track position in its update function (zpos += zvel),
// exactly like GameObj.UpdatePlayer (GameObj.as:1994). No Box2D body — cars are pure arcade.
function spawnArcadeCar(game: Game, opts: { xpos?: number; zpos?: number; zvel?: number } = {}): GameObj {
  const go = new GameObj();
  go.clip = "TestCar";
  go.xpos = opts.xpos ?? 0;
  go.zpos = opts.zpos ?? 0;
  go.zvel = opts.zvel ?? 0;
  go.updateFunction = (g) => {
    g.zpos += g.zvel; // arcade integration, in track-space
  };
  game.gameObjects.add(go);
  return go;
}

describe("arcade game-loop spine", () => {
  it("constants mirror PhysicsBase.as exactly (Box2D is vendored but unused in gameplay)", () => {
    expect(PhysicsBase.p2w).toBe(20);
    expect(PhysicsBase.w2p).toBe(0.05);
    expect(PhysicsBase.physGravity).toBe(20);
    expect(PhysicsBase.physStep).toBe(1 / 80);
    expect(PhysicsBase.physNumIterations).toBe(10);
  });

  it("runs each car's arcade update (zpos += zvel) every frame — no Box2D step", () => {
    const game = new Game();
    game.init();
    const car = spawnArcadeCar(game, { zpos: 0, zvel: 3 });

    for (let i = 0; i < 30; i++) game.updateGameplay();

    expect(car.zpos).toBe(90); // 30 frames × zvel 3 — integer-exact, no physics
    expect(game.frameCount).toBe(30);
  });

  it("follow camera tracks the player's raw track coords (GameObj.as:1657-1659)", () => {
    const game = new Game();
    game.init();
    const player = spawnArcadeCar(game, { xpos: 12, zpos: 0, zvel: 5 });
    player.ypos = 4;
    player.playerCamOffsetX = 1;
    player.playerCamOffsetY = 200;
    player.playerCamOffsetZ = -30;
    game.player = player;

    game.updateGameplay(); // zpos 0→5, then camera follows

    expect(game.roadCamera.cameraX).toBeCloseTo(12 + 1, 9); // xpos + offX
    expect(game.roadCamera.cameraY).toBeCloseTo(-(4 * 0.7) + 200, 9); // -(ypos*0.7) + offY
    expect(game.roadCamera.cameraZ).toBeCloseTo(5 + -30, 9); // zpos + offZ
  });

  it("emits RenderFrame v2: is3DObject → objects3D (track), else → overlays (screen), visible only", () => {
    const game = new Game();
    game.init();
    const car = spawnArcadeCar(game, { xpos: 10, zpos: 42 });
    car.is3DObject = true;
    const hud = spawnArcadeCar(game, { xpos: -5 }); // overlay (is3DObject false)
    const hidden = spawnArcadeCar(game, {});
    hidden.visible = false; // excluded from both lists

    const frame = game.tick();
    expect(frame.stage).toEqual({ width: 640, height: 480 });
    // 3D object → objects3D in TRACK coords (xpos lateral, zpos along-track)
    expect(frame.objects3D).toHaveLength(1);
    expect(frame.objects3D[0].clip).toBe("TestCar");
    expect(frame.objects3D[0].xpos).toBe(10);
    expect(frame.objects3D[0].zpos).toBe(42);
    // overlay → SCREEN coords (camera baked game-side; emit passes xpos straight through)
    expect(frame.overlays).toHaveLength(1); // hidden excluded
    expect(frame.overlays[0].x).toBe(-5);
  });

  it("killObjects deactivates + calls removeFunction; object leaves the RenderFrame", () => {
    const game = new Game();
    game.init();
    let removed = false;
    const go = spawnArcadeCar(game, {});
    go.removeFunction = () => {
      removed = true;
    };

    go.kill(); // flag for removal
    game.tick(); // kill happens inside updateGameplay
    expect(go.active).toBe(false);
    expect(removed).toBe(true);
    const f = game.render();
    expect(f.objects3D).toHaveLength(0);
    expect(f.overlays).toHaveLength(0);
  });

  it("addList: a spawn requested during update is drained the same frame (after update)", () => {
    const game = new Game();
    game.init();
    const spawner = spawnArcadeCar(game, {});
    const child = new GameObj();
    let spawned = false;
    spawner.updateFunction = () => {
      game.gameObjects.addToAddList(() => {
        game.gameObjects.add(child);
        spawned = true;
      }, null);
    };

    game.updateGameplay(); // update queues, doAddList drains
    expect(spawned).toBe(true);
    expect(game.gameObjects.objs).toContain(child);
  });
});
