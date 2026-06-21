// Port of Box2D/Dynamics/Joints/b2DistanceJointDef.as (Box2DFlash 2.0.2), line-by-line.
import { b2JointDef } from "./b2JointDef";
import { b2Joint } from "./b2Joint";
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import type { b2Body } from "../b2Body";

export class b2DistanceJointDef extends b2JointDef {
  public localAnchor1: b2Vec2 = new b2Vec2();
  public localAnchor2: b2Vec2 = new b2Vec2();
  public length!: number;
  public frequencyHz!: number;
  public dampingRatio!: number;

  // b2DistanceJointDef.as:18-25
  constructor() {
    super();
    this.type = b2Joint.e_distanceJoint;
    this.length = 1;
    this.frequencyHz = 0;
    this.dampingRatio = 0;
  }

  // b2DistanceJointDef.as:27-37
  public Initialize(body1: b2Body, body2: b2Body, anchor1: b2Vec2, anchor2: b2Vec2): void {
    this.body1 = body1;
    this.body2 = body2;
    this.localAnchor1.SetV(this.body1.GetLocalPoint(anchor1));
    this.localAnchor2.SetV(this.body2.GetLocalPoint(anchor2));
    const dX: number = anchor2.x - anchor1.x;
    const dY: number = anchor2.y - anchor1.y;
    this.length = Math.sqrt(dX * dX + dY * dY);
    this.frequencyHz = 0;
    this.dampingRatio = 0;
  }
}
