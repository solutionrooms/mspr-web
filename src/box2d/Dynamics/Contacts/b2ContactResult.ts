// Port of Box2D/Dynamics/Contacts/b2ContactResult.as (Box2DFlash 2.0.2), verbatim.
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import { b2ContactID } from "../../Collision/b2ContactID";
import type { b2Shape } from "../../Collision/Shapes/b2Shape";

export class b2ContactResult {
  public shape1: b2Shape | null = null;
  public shape2: b2Shape | null = null;
  public position: b2Vec2 = new b2Vec2();
  public normal: b2Vec2 = new b2Vec2();
  public normalImpulse!: number;
  public tangentImpulse!: number;
  public id: b2ContactID = new b2ContactID();
}
