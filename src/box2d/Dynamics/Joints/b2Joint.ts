// SCAFFOLD until m6 (joints). Full b2Joint.as (+ the six joint subclasses) is ported
// at the joints milestone. The static type constants are REAL (b2World.DrawJoint reads
// them) and the instance fields match the original so b2World's island assembly and
// CreateJoint/DestroyJoint type-check. The freefall goldens create no joint, so no
// method below runs.
import type { b2Body } from "../b2Body";
import type { b2JointDef } from "./b2JointDef";
import type { b2TimeStep } from "../b2TimeStep";
import type { b2Vec2 } from "../../Common/Math/b2Vec2";
import { b2JointEdge } from "./b2JointEdge";
import { notPorted } from "../../_internal/notPorted";

export class b2Joint {
  // b2Joint.as:10-30 (exact)
  public static readonly e_unknownJoint: number = 0;
  public static readonly e_revoluteJoint: number = 1;
  public static readonly e_prismaticJoint: number = 2;
  public static readonly e_distanceJoint: number = 3;
  public static readonly e_pulleyJoint: number = 4;
  public static readonly e_mouseJoint: number = 5;
  public static readonly e_gearJoint: number = 6;
  public static readonly e_inactiveLimit: number = 0;
  public static readonly e_atLowerLimit: number = 1;
  public static readonly e_atUpperLimit: number = 2;
  public static readonly e_equalLimits: number = 3;

  public m_type!: number;
  public m_prev: b2Joint | null = null;
  public m_next: b2Joint | null = null;
  public m_node1: b2JointEdge = new b2JointEdge();
  public m_node2: b2JointEdge = new b2JointEdge();
  public m_body1!: b2Body;
  public m_body2!: b2Body;
  public m_inv_dt!: number;
  public m_islandFlag: boolean = false;
  public m_collideConnected!: boolean;
  public m_userData: unknown;

  public static Create(_def: b2JointDef, _allocator: unknown): b2Joint {
    return notPorted("b2Joint.Create (m6: joints)");
  }
  public static Destroy(_joint: b2Joint, _allocator: unknown): void {
    notPorted("b2Joint.Destroy (m6: joints)");
  }
  public InitVelocityConstraints(_step: b2TimeStep): void {
    notPorted("b2Joint.InitVelocityConstraints (m6: joints)");
  }
  public SolveVelocityConstraints(_step: b2TimeStep): void {
    notPorted("b2Joint.SolveVelocityConstraints (m6: joints)");
  }
  public InitPositionConstraints(): void {
    notPorted("b2Joint.InitPositionConstraints (m6: joints)");
  }
  public SolvePositionConstraints(): boolean {
    return notPorted("b2Joint.SolvePositionConstraints (m6: joints)");
  }
  public GetAnchor1(): b2Vec2 {
    return notPorted("b2Joint.GetAnchor1 (m6: joints)");
  }
  public GetAnchor2(): b2Vec2 {
    return notPorted("b2Joint.GetAnchor2 (m6: joints)");
  }
}
