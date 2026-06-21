// The game↔arcade-engine seam: the game spawns a player (Game.spawnPlayer, faithful to the
// shipped RaceEventDay spawn + GameObj.InitPlayer a0-subset) and its updateFunction runs the
// REAL bit-exact arcade integrator (engine-owned src/game/arcade/update-player.ts) through the
// race loop, with the follow camera tracking it. NOT the bit-exact golden (that's the engine's
// a0 Ruffle gate) — this proves the framework wiring closes the loop on the real engine.
import { describe, it, expect } from "vitest";
import { Game } from "../../src/game/game";

describe("player spawn + arcade engine seam (a0 coast)", () => {
  it("spawns a faithful player car (InitPlayer a0-subset)", () => {
    const game = new Game();
    game.init();
    const player = game.spawnPlayer(100); // grid start z = 100

    expect(player.name).toBe("player");
    expect(player.is3DObject).toBe(true);
    expect(player.useLapForRender).toBe(true);
    expect(player.dir).toBe(0);
    expect(player.zvel).toBe(0);
    expect(player.zpos).toBe(100);
    expect(player.oldzpos).toBe(100);
    expect(player.playerCamOffsetX).toBe(0);
    expect(game.player).toBe(player);
  });

  it("runs the real coast integrator through updateGameplay; follow camera tracks it", () => {
    const game = new Game();
    game.init();
    const player = game.spawnPlayer(100);
    player.zvel = 5; // GameVars.rollingStartZvel — a0 coast start

    game.updateGameplay(); // player.updateFunction → updatePlayerCoast (engine), then camera-follow
    expect(player.oldzpos).toBe(100); // preamble captured last tick's zpos
    expect(player.zpos).toBe(105); // 100 + 5
    expect(player.zvel).toBe(5 - 0.1); // same decel op as the integrator (deterministic)
    expect(game.roadCamera.cameraZ).toBe(105); // camera.z = zpos + offZ(0)

    for (let i = 0; i < 80; i++) game.updateGameplay();
    expect(player.zvel).toBe(0); // clamped to a dead stop
    expect(player.zpos).toBeGreaterThan(105); // coasted forward, then stopped
    // camera stayed locked to the (now-stopped) player
    expect(game.roadCamera.cameraZ).toBe(player.zpos);
  });
});
