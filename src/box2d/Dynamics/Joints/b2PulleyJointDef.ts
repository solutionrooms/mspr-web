// Port of Box2D/Dynamics/Joints/b2PulleyJointDef.as (Box2DFlash 2.0.2), line-by-line.
// (FZ3's PhysicsBase instantiates this def but never builds the joint from it.)
import { b2JointDef } from "./b2JointDef";
import { b2Joint } from "./b2Joint";
import { b2PulleyJoint } from "./b2PulleyJoint";
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import type { b2Body } from "../b2Body";

export class b2PulleyJointDef extends b2JointDef {
  public groundAnchor1: b2Vec2 = new b2Vec2();
  public groundAnchor2: b2Vec2 = new b2Vec2();
  public localAnchor1: b2Vec2 = new b2Vec2();
  public localAnchor2: b2Vec2 = new b2Vec2();
  public length1!: number;
  public maxLength1!: number;
  public length2!: number;
  public maxLength2!: number;
  public ratio!: number;

  constructor() {
    super();
    this.type = b2Joint.e_pulleyJoint;
    this.groundAnchor1.Set(-1, 1);
    this.groundAnchor2.Set(1, 1);
    this.localAnchor1.Set(-1, 0);
    this.localAnchor2.Set(1, 0);
    this.length1 = 0;
    this.maxLength1 = 0;
    this.length2 = 0;
    this.maxLength2 = 0;
    this.ratio = 1;
    this.collideConnected = true;
  }

  public Initialize(
    body1: b2Body,
    body2: b2Body,
    groundAnchor1: b2Vec2,
    groundAnchor2: b2Vec2,
    anchor1: b2Vec2,
    anchor2: b2Vec2,
    ratio: number,
  ): void {
    this.body1 = body1;
    this.body2 = body2;
    this.groundAnchor1.SetV(groundAnchor1);
    this.groundAnchor2.SetV(groundAnchor2);
    this.localAnchor1 = this.body1.GetLocalPoint(anchor1);
    this.localAnchor2 = this.body2.GetLocalPoint(anchor2);
    const d1X: number = anchor1.x - groundAnchor1.x;
    const d1Y: number = anchor1.y - groundAnchor1.y;
    this.length1 = Math.sqrt(d1X * d1X + d1Y * d1Y);
    const d2X: number = anchor2.x - groundAnchor2.x;
    const d2Y: number = anchor2.y - groundAnchor2.y;
    this.length2 = Math.sqrt(d2X * d2X + d2Y * d2Y);
    this.ratio = ratio;
    const C: number = this.length1 + this.ratio * this.length2;
    this.maxLength1 = C - this.ratio * b2PulleyJoint.b2_minPulleyLength;
    this.maxLength2 = (C - b2PulleyJoint.b2_minPulleyLength) / this.ratio;
  }
}
