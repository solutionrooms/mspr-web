// The game's Box2D adapter. World construction + the fixed step cadence live here; the
// physobj→bodies/shapes/joints factory (AddPhysObjAt) is the engine's m6 seam.
// Cite: PhysicsBase.as (mspr constants — load-bearing, NOT FZ3's).
import { b2World } from "../box2d/Dynamics/b2World";
import { b2AABB } from "../box2d/Collision/b2AABB";
import { b2Vec2 } from "../box2d/Common/Math/b2Vec2";

export class PhysicsBase {
  static readonly p2w = 20; // 20 px = 1 Box2D metre   (PhysicsBase.as:36)
  static readonly w2p = 1 / 20; // 0.05                 (PhysicsBase.as:38)
  static readonly gravity = 400; // GameVars.gravity px/s² (GameVars.as:199)
  static readonly physGravity = 400 * (1 / 20); // = 20 world units (GameVars.gravity × w2p)
  static readonly physStep = 1 / 80; // physStep         (PhysicsBase.as:34)
  static readonly physNumIterations = 10; // physNumIterations (PhysicsBase.as:32)

  world!: b2World;

  /** PhysicsBase.InitBox2D — AABB ±25000, gravity (0, physGravity), allowSleep. */
  initBox2D(): void {
    const aabb = new b2AABB();
    aabb.lowerBound.Set(-25000, -25000);
    aabb.upperBound.Set(25000, 25000);
    this.world = new b2World(aabb, new b2Vec2(0, PhysicsBase.physGravity), true);
  }

  /** The per-update physics cadence: TWO back-to-back fixed substeps (Game.as:2232-2233).
   *  Reproduce the count + order EXACTLY — a doubled or mis-ordered step desyncs the sim. */
  step(): void {
    this.world.Step(PhysicsBase.physStep, PhysicsBase.physNumIterations);
    this.world.Step(PhysicsBase.physStep, PhysicsBase.physNumIterations);
  }

  /**
   * ENGINE SEAM (m6): turn a physobj def into a b2Body (+ shapes + joints) at pixel
   * (x, y). This is mspr's PhysicsBase.AddPhysObjAt (~52 lines off FZ3's), which the
   * engine ports once m6 joints + b2Body.ShouldCollide land. Until then the level loads
   * as data only (no physics instances). See ENGINE_DEV.md / DEVELOPER_MESSAGES (m6).
   */
  addPhysObjAt(): never {
    throw new Error(
      "PhysicsBase.addPhysObjAt is not wired until engine m6 (joints). See DEVELOPER_MESSAGES.",
    );
  }
}
