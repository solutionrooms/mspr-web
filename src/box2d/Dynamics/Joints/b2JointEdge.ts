// Port of Box2D/Dynamics/Joints/b2JointEdge.as (Box2DFlash 2.0.2), verbatim.
import type { b2Body } from "../b2Body";
import type { b2Joint } from "./b2Joint";

export class b2JointEdge {
  public other: b2Body | null = null;
  public joint: b2Joint | null = null;
  public prev: b2JointEdge | null = null;
  public next: b2JointEdge | null = null;
}
