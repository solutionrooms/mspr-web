// Port of Box2D/Dynamics/Contacts/b2ContactConstraintPoint.as (Box2DFlash 2.0.2), verbatim.
import { b2Vec2 } from "../../Common/Math/b2Vec2";

export class b2ContactConstraintPoint {
  public localAnchor1: b2Vec2 = new b2Vec2();
  public localAnchor2: b2Vec2 = new b2Vec2();
  public r1: b2Vec2 = new b2Vec2();
  public r2: b2Vec2 = new b2Vec2();
  public normalImpulse!: number;
  public tangentImpulse!: number;
  public positionImpulse!: number;
  public normalMass!: number;
  public tangentMass!: number;
  public equalizedMass!: number;
  public separation!: number;
  public velocityBias!: number;
}
