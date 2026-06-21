// Port of Box2D/Dynamics/Joints/b2GearJointDef.as (Box2DFlash 2.0.2), verbatim.
// (Unused by FZ3, ported for completeness.)
import { b2JointDef } from "./b2JointDef";
import { b2Joint } from "./b2Joint";

export class b2GearJointDef extends b2JointDef {
  public joint1: b2Joint | null = null;
  public joint2: b2Joint | null = null;
  public ratio!: number;

  constructor() {
    super();
    this.type = b2Joint.e_gearJoint;
    this.joint1 = null;
    this.joint2 = null;
    this.ratio = 1;
  }
}
