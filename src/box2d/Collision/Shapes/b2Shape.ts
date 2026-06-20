// Port of Box2D/Collision/Shapes/b2Shape.as (Box2DFlash 2.0.2), line-by-line.
// Base shape: proxy lifecycle (CreateProxy/Synchronize/RefilterProxy) against the
// SAP broadphase, filter data, and the virtual hooks (ComputeAABB/ComputeMass/
// TestPoint/TestSegment) overridden by b2CircleShape/b2PolygonShape. Op order preserved.
import { b2AABB } from "../b2AABB";
import type { b2BroadPhase } from "../b2BroadPhase";
import { b2Pair } from "../b2Pair";
import type { b2Segment } from "../b2Segment";
import type { b2Vec2 } from "../../Common/Math/b2Vec2";
import type { b2XForm } from "../../Common/Math/b2XForm";
import type { b2Body } from "../../Dynamics/b2Body";
import { b2FilterData } from "./b2FilterData";
import type { b2ShapeDef } from "./b2ShapeDef";
import type { b2MassData } from "./b2MassData";
import { createShapeByType } from "./_shapeFactory";

export class b2Shape {
  // b2Shape.as:14-18 (statics)
  private static s_proxyAABB: b2AABB = new b2AABB();
  private static s_syncAABB: b2AABB = new b2AABB();
  private static s_resetAABB: b2AABB = new b2AABB();

  // b2Shape.as:20-32 (type & collide-result tags, exact)
  public static readonly e_unknownShape: number = -1;
  public static readonly e_circleShape: number = 0;
  public static readonly e_polygonShape: number = 1;
  public static readonly e_shapeTypeCount: number = 2;
  public static readonly e_hitCollide: number = 1;
  public static readonly e_missCollide: number = 0;
  public static readonly e_startsInsideCollide: number = -1;

  public m_type: number = b2Shape.e_unknownShape;
  public m_next: b2Shape | null = null;
  public m_body: b2Body | null = null;
  public m_sweepRadius!: number;
  public m_density!: number;
  public m_friction!: number;
  public m_restitution!: number;
  public m_proxyId!: number;
  public m_filter!: b2FilterData;
  public m_isSensor!: boolean;
  public m_userData: unknown;

  // b2Shape.as:56-69
  constructor(def: b2ShapeDef) {
    this.m_userData = def.userData;
    this.m_friction = def.friction;
    this.m_restitution = def.restitution;
    this.m_density = def.density;
    this.m_body = null;
    this.m_sweepRadius = 0;
    this.m_next = null;
    this.m_proxyId = b2Pair.b2_nullProxy;
    this.m_filter = def.filter.Copy();
    this.m_isSensor = def.isSensor;
  }

  // b2Shape.as:71-82 (factory dispatch via the registry — see _shapeFactory.ts)
  public static Create(def: b2ShapeDef, _allocator: unknown): b2Shape | null {
    return createShapeByType(def.type, def);
  }

  // b2Shape.as:84-86
  public static Destroy(_shape: b2Shape, _allocator: unknown): void {}

  // b2Shape.as:88-91
  public GetType(): number {
    return this.m_type;
  }

  // b2Shape.as:93-96
  public IsSensor(): boolean {
    return this.m_isSensor;
  }

  // b2Shape.as:98-101
  public SetFilterData(filter: b2FilterData): void {
    this.m_filter = filter.Copy();
  }

  // b2Shape.as:103-106
  public GetFilterData(): b2FilterData {
    return this.m_filter.Copy();
  }

  // b2Shape.as:108-111
  public GetBody(): b2Body | null {
    return this.m_body;
  }

  // b2Shape.as:113-116
  public GetNext(): b2Shape | null {
    return this.m_next;
  }

  // b2Shape.as:118-126
  public GetUserData(): unknown {
    return this.m_userData;
  }
  public SetUserData(data: unknown): void {
    this.m_userData = data;
  }

  // b2Shape.as:128-148 (virtual hooks — overridden by subclasses)
  public TestPoint(_xf: b2XForm, _p: b2Vec2): boolean {
    return false;
  }
  public TestSegment(_xf: b2XForm, _lambda: number[], _normal: b2Vec2, _segment: b2Segment, _maxLambda: number): number {
    return b2Shape.e_missCollide;
  }
  public ComputeAABB(_aabb: b2AABB, _xf: b2XForm): void {}
  public ComputeSweptAABB(_aabb: b2AABB, _xf1: b2XForm, _xf2: b2XForm): void {}
  public ComputeMass(_massData: b2MassData): void {}

  // b2Shape.as:150-163
  public GetSweepRadius(): number {
    return this.m_sweepRadius;
  }
  public GetFriction(): number {
    return this.m_friction;
  }
  public GetRestitution(): number {
    return this.m_restitution;
  }

  // b2Shape.as:165-178
  public CreateProxy(broadPhase: b2BroadPhase, transform: b2XForm): void {
    const aabb: b2AABB = b2Shape.s_proxyAABB;
    this.ComputeAABB(aabb, transform);
    const inRange: boolean = broadPhase.InRange(aabb);
    if (inRange) {
      this.m_proxyId = broadPhase.CreateProxy(aabb, this);
    } else {
      this.m_proxyId = b2Pair.b2_nullProxy;
    }
  }

  // b2Shape.as:180-187
  public DestroyProxy(broadPhase: b2BroadPhase): void {
    if (this.m_proxyId !== b2Pair.b2_nullProxy) {
      broadPhase.DestroyProxy(this.m_proxyId);
      this.m_proxyId = b2Pair.b2_nullProxy;
    }
  }

  // b2Shape.as:189-203
  public Synchronize(broadPhase: b2BroadPhase, transform1: b2XForm, transform2: b2XForm): boolean {
    if (this.m_proxyId === b2Pair.b2_nullProxy) {
      return false;
    }
    const aabb: b2AABB = b2Shape.s_syncAABB;
    this.ComputeSweptAABB(aabb, transform1, transform2);
    if (broadPhase.InRange(aabb)) {
      broadPhase.MoveProxy(this.m_proxyId, aabb);
      return true;
    }
    return false;
  }

  // b2Shape.as:205-223
  public RefilterProxy(broadPhase: b2BroadPhase, transform: b2XForm): void {
    if (this.m_proxyId === b2Pair.b2_nullProxy) {
      return;
    }
    broadPhase.DestroyProxy(this.m_proxyId);
    const aabb: b2AABB = b2Shape.s_resetAABB;
    this.ComputeAABB(aabb, transform);
    const inRange: boolean = broadPhase.InRange(aabb);
    if (inRange) {
      this.m_proxyId = broadPhase.CreateProxy(aabb, this);
    } else {
      this.m_proxyId = b2Pair.b2_nullProxy;
    }
  }

  // b2Shape.as:225-227
  public UpdateSweepRadius(_center: b2Vec2): void {}
}
