// Port of Box2D/Collision/b2ManifoldPoint.as (Box2DFlash 2.0.2), verbatim.
import { b2Vec2 } from "../Common/Math/b2Vec2";
import { b2ContactID } from "./b2ContactID";

export class b2ManifoldPoint {
  public localPoint1: b2Vec2 = new b2Vec2();
  public localPoint2: b2Vec2 = new b2Vec2();
  public separation!: number;
  public normalImpulse!: number;
  public tangentImpulse!: number;
  public id: b2ContactID = new b2ContactID();

  // b2ManifoldPoint.as:24-31
  public Reset(): void {
    this.localPoint1.SetZero();
    this.localPoint2.SetZero();
    this.separation = 0;
    this.normalImpulse = 0;
    this.tangentImpulse = 0;
    this.id.key = 0;
  }

  // b2ManifoldPoint.as:33-40
  public Set(m: b2ManifoldPoint): void {
    this.localPoint1.SetV(m.localPoint1);
    this.localPoint2.SetV(m.localPoint2);
    this.separation = m.separation;
    this.normalImpulse = m.normalImpulse;
    this.tangentImpulse = m.tangentImpulse;
    this.id.key = m.id.key;
  }
}
