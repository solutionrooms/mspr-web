// SCAFFOLD until m6 (joints). Parameter type for b2World.CreateJoint, not exercised
// by the freefall goldens. Full b2JointDef.as ported at the joints milestone.
import type { b2Body } from "../b2Body";

export class b2JointDef {
  public type!: number;
  public userData: unknown;
  public body1!: b2Body;
  public body2!: b2Body;
  public collideConnected!: boolean;
}
