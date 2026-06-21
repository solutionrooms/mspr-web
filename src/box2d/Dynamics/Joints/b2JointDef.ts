// Port of Box2D/Dynamics/Joints/b2JointDef.as (Box2DFlash 2.0.2), verbatim.
import { b2Joint } from "./b2Joint";
import type { b2Body } from "../b2Body";

export class b2JointDef {
  public type: number = b2Joint.e_unknownJoint;
  public userData: unknown = null;
  public body1: b2Body | null = null;
  public body2: b2Body | null = null;
  public collideConnected: boolean = false;
}
