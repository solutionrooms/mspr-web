// Port of Box2D/Dynamics/Joints/b2RevoluteJointDef.as (Box2DFlash 2.0.2), line-by-line.
import { b2JointDef } from "./b2JointDef";
import { b2Joint } from "./b2Joint";
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import type { b2Body } from "../b2Body";

export class b2RevoluteJointDef extends b2JointDef {
  public localAnchor1: b2Vec2 = new b2Vec2();
  public localAnchor2: b2Vec2 = new b2Vec2();
  public referenceAngle!: number;
  public enableLimit!: boolean;
  public lowerAngle!: number;
  public upperAngle!: number;
  public enableMotor!: boolean;
  public motorSpeed!: number;
  public maxMotorTorque!: number;

  // b2RevoluteJointDef.as:24-39
  constructor() {
    super();
    this.type = b2Joint.e_revoluteJoint;
    this.localAnchor1.Set(0, 0);
    this.localAnchor2.Set(0, 0);
    this.referenceAngle = 0;
    this.lowerAngle = 0;
    this.upperAngle = 0;
    this.maxMotorTorque = 0;
    this.motorSpeed = 0;
    this.enableLimit = false;
    this.enableMotor = false;
  }

  // b2RevoluteJointDef.as:41-48
  public Initialize(body1: b2Body, body2: b2Body, anchor: b2Vec2): void {
    this.body1 = body1;
    this.body2 = body2;
    this.localAnchor1 = this.body1.GetLocalPoint(anchor);
    this.localAnchor2 = this.body2.GetLocalPoint(anchor);
    this.referenceAngle = this.body2.GetAngle() - this.body1.GetAngle();
  }
}
