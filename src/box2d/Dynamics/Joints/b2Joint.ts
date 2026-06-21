// Port of Box2D/Dynamics/Joints/b2Joint.as (Box2DFlash 2.0.2), line-by-line.
// Base joint: type tags, the create-factory dispatch (via _jointFactory registry),
// the node/body links, and the virtual constraint hooks overridden by each subclass.
// Op order preserved.
import type { b2Vec2 } from "../../Common/Math/b2Vec2";
import type { b2Body } from "../b2Body";
import type { b2TimeStep } from "../b2TimeStep";
import { b2JointEdge } from "./b2JointEdge";
import type { b2JointDef } from "./b2JointDef";
import { createJointByType } from "./_jointFactory";

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

  // b2Joint.as:54-65
  constructor(def: b2JointDef) {
    this.m_type = def.type;
    this.m_prev = null;
    this.m_next = null;
    this.m_body1 = def.body1!;
    this.m_body2 = def.body2!;
    this.m_collideConnected = def.collideConnected;
    this.m_islandFlag = false;
    this.m_userData = def.userData;
  }

  // b2Joint.as:67-91 (factory dispatch via the registry — see _jointFactory.ts)
  public static Create(def: b2JointDef, _allocator: unknown): b2Joint {
    return createJointByType(def.type, def) as b2Joint;
  }

  // b2Joint.as:93-95
  public static Destroy(_joint: b2Joint, _allocator: unknown): void {}

  // b2Joint.as:97-145
  public GetType(): number {
    return this.m_type;
  }
  public GetAnchor1(): b2Vec2 {
    return null as unknown as b2Vec2;
  }
  public GetAnchor2(): b2Vec2 {
    return null as unknown as b2Vec2;
  }
  public GetReactionForce(): b2Vec2 {
    return null as unknown as b2Vec2;
  }
  public GetReactionTorque(): number {
    return 0;
  }
  public GetBody1(): b2Body {
    return this.m_body1;
  }
  public GetBody2(): b2Body {
    return this.m_body2;
  }
  public GetNext(): b2Joint | null {
    return this.m_next;
  }
  public GetUserData(): unknown {
    return this.m_userData;
  }
  public SetUserData(data: unknown): void {
    this.m_userData = data;
  }

  // b2Joint.as:147-162 (virtual — overridden by subclasses)
  public InitVelocityConstraints(_step: b2TimeStep): void {}
  public SolveVelocityConstraints(_step: b2TimeStep): void {}
  public InitPositionConstraints(): void {}
  public SolvePositionConstraints(): boolean {
    return false;
  }
}
