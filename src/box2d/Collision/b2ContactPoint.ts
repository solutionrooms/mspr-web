// Port of Box2D/Collision/b2ContactPoint.as (Box2DFlash 2.0.2), verbatim.
// Passed to b2ContactListener.Add/Persist/Remove.
import { b2Vec2 } from "../Common/Math/b2Vec2";
import { b2ContactID } from "./b2ContactID";
import type { b2Shape } from "./Shapes/b2Shape";

export class b2ContactPoint {
  public shape1: b2Shape | null = null;
  public shape2: b2Shape | null = null;
  public position: b2Vec2 = new b2Vec2();
  public velocity: b2Vec2 = new b2Vec2();
  public normal: b2Vec2 = new b2Vec2();
  public separation!: number;
  public friction!: number;
  public restitution!: number;
  public id: b2ContactID = new b2ContactID();
}
