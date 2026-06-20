// Port of Box2D/Dynamics/Contacts/b2ContactConstraint.as (Box2DFlash 2.0.2), verbatim.
import { b2Settings } from "../../Common/b2Settings";
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import { b2ContactConstraintPoint } from "./b2ContactConstraintPoint";
import type { b2Manifold } from "../../Collision/b2Manifold";
import type { b2Body } from "../b2Body";

export class b2ContactConstraint {
  public points: b2ContactConstraintPoint[];
  public normal: b2Vec2 = new b2Vec2();
  public manifold!: b2Manifold;
  public body1!: b2Body;
  public body2!: b2Body;
  public friction!: number;
  public restitution!: number;
  public pointCount!: number;

  // b2ContactConstraint.as:28-38
  constructor() {
    this.points = new Array(b2Settings.b2_maxManifoldPoints);
    let i = 0;
    while (i < b2Settings.b2_maxManifoldPoints) {
      this.points[i] = new b2ContactConstraintPoint();
      i++;
    }
  }
}
