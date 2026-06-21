// Port of Box2D/Dynamics/Joints/b2MouseJointDef.as (Box2DFlash 2.0.2), verbatim.
import { b2JointDef } from "./b2JointDef";
import { b2Joint } from "./b2Joint";
import { b2Vec2 } from "../../Common/Math/b2Vec2";

export class b2MouseJointDef extends b2JointDef {
  public target: b2Vec2 = new b2Vec2();
  public maxForce!: number;
  public frequencyHz!: number;
  public dampingRatio!: number;
  public timeStep!: number;

  // b2MouseJointDef.as:16-23
  constructor() {
    super();
    this.type = b2Joint.e_mouseJoint;
    this.maxForce = 0;
    this.frequencyHz = 5;
    this.dampingRatio = 0.7;
    this.timeStep = 1 / 60;
  }
}
