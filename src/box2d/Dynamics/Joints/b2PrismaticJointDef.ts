// Port of Box2D/Dynamics/Joints/b2PrismaticJointDef.as (Box2DFlash 2.0.2), line-by-line.
import { b2JointDef } from "./b2JointDef";
import { b2Joint } from "./b2Joint";
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import type { b2Body } from "../b2Body";

export class b2PrismaticJointDef extends b2JointDef {
  public localAnchor1: b2Vec2 = new b2Vec2();
  public localAnchor2: b2Vec2 = new b2Vec2();
  public localAxis1: b2Vec2 = new b2Vec2();
  public referenceAngle!: number;
  public enableLimit!: boolean;
  public lowerTranslation!: number;
  public upperTranslation!: number;
  public enableMotor!: boolean;
  public maxMotorForce!: number;
  public motorSpeed!: number;

  constructor() {
    super();
    this.type = b2Joint.e_prismaticJoint;
    this.localAxis1.Set(1, 0);
    this.referenceAngle = 0;
    this.enableLimit = false;
    this.lowerTranslation = 0;
    this.upperTranslation = 0;
    this.enableMotor = false;
    this.maxMotorForce = 0;
    this.motorSpeed = 0;
  }

  public Initialize(body1: b2Body, body2: b2Body, anchor: b2Vec2, axis: b2Vec2): void {
    this.body1 = body1;
    this.body2 = body2;
    this.localAnchor1 = this.body1.GetLocalPoint(anchor);
    this.localAnchor2 = this.body2.GetLocalPoint(anchor);
    this.localAxis1 = this.body1.GetLocalVector(axis);
    this.referenceAngle = this.body2.GetAngle() - this.body1.GetAngle();
  }
}
