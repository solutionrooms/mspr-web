// Port of Box2D/Dynamics/b2Body.as (Box2DFlash 2.0.2), line-by-line.
// Operation order preserved exactly — do NOT simplify arithmetic. The sweep/COM
// math here (constructor, SynchronizeTransform, SynchronizeShapes, Advance) is on
// the freefall hot path and is gated bit-exact by m0/m1.
import { b2MassData } from "../Collision/Shapes/b2MassData";
import { b2Shape } from "../Collision/Shapes/b2Shape";
import type { b2ShapeDef } from "../Collision/Shapes/b2ShapeDef";
// Side-effect imports: the concrete shape classes register their constructors with
// the shape factory at module load, so b2Shape.Create(def) (called by CreateShape
// below) can dispatch. Cycle-safe — the subclasses only type-import b2Body.
import "../Collision/Shapes/b2CircleShape";
import "../Collision/Shapes/b2PolygonShape";
import { b2Mat22 } from "../Common/Math/b2Mat22";
import { b2Math } from "../Common/Math/b2Math";
import { b2Sweep } from "../Common/Math/b2Sweep";
import { b2Vec2 } from "../Common/Math/b2Vec2";
import { b2XForm } from "../Common/Math/b2XForm";
import { b2Settings } from "../Common/b2Settings";
import type { b2ContactEdge } from "./Contacts/b2ContactEdge";
import type { b2JointEdge } from "./Joints/b2JointEdge";
import type { b2BodyDef } from "./b2BodyDef";
import type { b2World } from "./b2World";

export class b2Body {
  // b2Body.as:18-20 (statics)
  private static s_massData: b2MassData = new b2MassData();
  private static s_xf1: b2XForm = new b2XForm();

  // b2Body.as:22-38 (flag/type tags)
  public static e_frozenFlag: number = 2;
  public static e_islandFlag: number = 4;
  public static e_sleepFlag: number = 8;
  public static e_allowSleepFlag: number = 16;
  public static e_bulletFlag: number = 32;
  public static e_fixedRotationFlag: number = 64;
  public static e_staticType: number = 1;
  public static e_dynamicType: number = 2;
  public static e_maxTypes: number = 3;

  public m_flags!: number;
  public m_type!: number;
  public m_xf: b2XForm = new b2XForm();
  public m_sweep: b2Sweep = new b2Sweep();
  public m_linearVelocity: b2Vec2 = new b2Vec2();
  public m_angularVelocity!: number;
  public m_force: b2Vec2 = new b2Vec2();
  public m_torque!: number;
  public m_world: b2World;
  public m_prev: b2Body | null = null;
  public m_next: b2Body | null = null;
  public m_shapeList: b2Shape | null = null;
  public m_shapeCount!: number;
  public m_jointList: b2JointEdge | null = null;
  public m_contactList: b2ContactEdge | null = null;
  public m_mass!: number;
  public m_invMass!: number;
  public m_I!: number;
  public m_invI!: number;
  public m_linearDamping!: number;
  public m_angularDamping!: number;
  public m_sleepTime!: number;
  public m_userData: unknown;

  // b2Body.as:86-157
  constructor(bd: b2BodyDef, world: b2World) {
    this.m_flags = 0;
    if (bd.isBullet) {
      this.m_flags |= b2Body.e_bulletFlag;
    }
    if (bd.fixedRotation) {
      this.m_flags |= b2Body.e_fixedRotationFlag;
    }
    if (bd.allowSleep) {
      this.m_flags |= b2Body.e_allowSleepFlag;
    }
    if (bd.isSleeping) {
      this.m_flags |= b2Body.e_sleepFlag;
    }
    this.m_world = world;
    this.m_xf.position.SetV(bd.position);
    this.m_xf.R.Set(bd.angle);
    this.m_sweep.localCenter.SetV(bd.massData.center);
    this.m_sweep.t0 = 1;
    this.m_sweep.a0 = this.m_sweep.a = bd.angle;
    const tMat: b2Mat22 = this.m_xf.R;
    const tVec: b2Vec2 = this.m_sweep.localCenter;
    this.m_sweep.c.x = tMat.col1.x * tVec.x + tMat.col2.x * tVec.y;
    this.m_sweep.c.y = tMat.col1.y * tVec.x + tMat.col2.y * tVec.y;
    this.m_sweep.c.x += this.m_xf.position.x;
    this.m_sweep.c.y += this.m_xf.position.y;
    this.m_sweep.c0.SetV(this.m_sweep.c);
    this.m_jointList = null;
    this.m_contactList = null;
    this.m_prev = null;
    this.m_next = null;
    this.m_linearDamping = bd.linearDamping;
    this.m_angularDamping = bd.angularDamping;
    this.m_force.Set(0, 0);
    this.m_torque = 0;
    this.m_linearVelocity.SetZero();
    this.m_angularVelocity = 0;
    this.m_sleepTime = 0;
    this.m_invMass = 0;
    this.m_I = 0;
    this.m_invI = 0;
    this.m_mass = bd.massData.mass;
    if (this.m_mass > 0) {
      this.m_invMass = 1 / this.m_mass;
    }
    if ((this.m_flags & b2Body.e_fixedRotationFlag) === 0) {
      this.m_I = bd.massData.I;
    }
    if (this.m_I > 0) {
      this.m_invI = 1 / this.m_I;
    }
    if (this.m_invMass === 0 && this.m_invI === 0) {
      this.m_type = b2Body.e_staticType;
    } else {
      this.m_type = b2Body.e_dynamicType;
    }
    this.m_userData = bd.userData;
    this.m_shapeList = null;
    this.m_shapeCount = 0;
  }

  // b2Body.as:159-173
  public CreateShape(def: b2ShapeDef): b2Shape | null {
    if (this.m_world.m_lock === true) {
      return null;
    }
    // b2Shape.Create returns null only for an unknown shape type; the AS3 assigns it
    // straight to a b2Shape and dereferences (would NPE on null) — we match with `!`.
    const shape: b2Shape = b2Shape.Create(def, this.m_world.m_blockAllocator)!;
    shape.m_next = this.m_shapeList;
    this.m_shapeList = shape;
    ++this.m_shapeCount;
    shape.m_body = this;
    shape.CreateProxy(this.m_world.m_broadPhase, this.m_xf);
    shape.UpdateSweepRadius(this.m_sweep.localCenter);
    return shape;
  }

  // b2Body.as:175-207
  public DestroyShape(shape: b2Shape): void {
    if (this.m_world.m_lock === true) {
      return;
    }
    shape.DestroyProxy(this.m_world.m_broadPhase);
    let s: b2Shape | null = this.m_shapeList;
    let prev: b2Shape | null = null;
    let found: boolean = false;
    while (s != null) {
      if (s === shape) {
        if (prev) {
          prev.m_next = shape.m_next;
        } else {
          this.m_shapeList = shape.m_next;
        }
        found = true;
        break;
      }
      prev = s;
      s = s.m_next;
    }
    shape.m_body = null;
    shape.m_next = null;
    --this.m_shapeCount;
    b2Shape.Destroy(shape, this.m_world.m_blockAllocator);
  }

  // b2Body.as:209-264
  public SetMass(massData: b2MassData): void {
    if (this.m_world.m_lock === true) {
      return;
    }
    this.m_invMass = 0;
    this.m_I = 0;
    this.m_invI = 0;
    this.m_mass = massData.mass;
    if (this.m_mass > 0) {
      this.m_invMass = 1 / this.m_mass;
    }
    if ((this.m_flags & b2Body.e_fixedRotationFlag) === 0) {
      this.m_I = massData.I;
    }
    if (this.m_I > 0) {
      this.m_invI = 1 / this.m_I;
    }
    this.m_sweep.localCenter.SetV(massData.center);
    const tMat: b2Mat22 = this.m_xf.R;
    const tVec: b2Vec2 = this.m_sweep.localCenter;
    this.m_sweep.c.x = tMat.col1.x * tVec.x + tMat.col2.x * tVec.y;
    this.m_sweep.c.y = tMat.col1.y * tVec.x + tMat.col2.y * tVec.y;
    this.m_sweep.c.x += this.m_xf.position.x;
    this.m_sweep.c.y += this.m_xf.position.y;
    this.m_sweep.c0.SetV(this.m_sweep.c);
    let s: b2Shape | null = this.m_shapeList;
    while (s) {
      s.UpdateSweepRadius(this.m_sweep.localCenter);
      s = s.m_next;
    }
    const oldType: number = this.m_type;
    if (this.m_invMass === 0 && this.m_invI === 0) {
      this.m_type = b2Body.e_staticType;
    } else {
      this.m_type = b2Body.e_dynamicType;
    }
    if (oldType !== this.m_type) {
      s = this.m_shapeList;
      while (s) {
        s.RefilterProxy(this.m_world.m_broadPhase, this.m_xf);
        s = s.m_next;
      }
    }
  }

  // b2Body.as:266-339
  public SetMassFromShapes(): void {
    b2Settings.b2Assert(this.m_world.m_lock === false);
    if (this.m_world.m_lock === true) {
      return;
    }
    this.m_mass = 0;
    this.m_invMass = 0;
    this.m_I = 0;
    this.m_invI = 0;
    let centerX: number = 0;
    let centerY: number = 0;
    const massData: b2MassData = b2Body.s_massData;
    let s: b2Shape | null = this.m_shapeList;
    while (s) {
      s.ComputeMass(massData);
      this.m_mass += massData.mass;
      centerX += massData.mass * massData.center.x;
      centerY += massData.mass * massData.center.y;
      this.m_I += massData.I;
      s = s.m_next;
    }
    if (this.m_mass > 0) {
      this.m_invMass = 1 / this.m_mass;
      centerX *= this.m_invMass;
      centerY *= this.m_invMass;
    }
    if (this.m_I > 0 && (this.m_flags & b2Body.e_fixedRotationFlag) === 0) {
      this.m_I -= this.m_mass * (centerX * centerX + centerY * centerY);
      this.m_invI = 1 / this.m_I;
    } else {
      this.m_I = 0;
      this.m_invI = 0;
    }
    this.m_sweep.localCenter.Set(centerX, centerY);
    const tMat: b2Mat22 = this.m_xf.R;
    const tVec: b2Vec2 = this.m_sweep.localCenter;
    this.m_sweep.c.x = tMat.col1.x * tVec.x + tMat.col2.x * tVec.y;
    this.m_sweep.c.y = tMat.col1.y * tVec.x + tMat.col2.y * tVec.y;
    this.m_sweep.c.x += this.m_xf.position.x;
    this.m_sweep.c.y += this.m_xf.position.y;
    this.m_sweep.c0.SetV(this.m_sweep.c);
    s = this.m_shapeList;
    while (s) {
      s.UpdateSweepRadius(this.m_sweep.localCenter);
      s = s.m_next;
    }
    const oldType: number = this.m_type;
    if (this.m_invMass === 0 && this.m_invI === 0) {
      this.m_type = b2Body.e_staticType;
    } else {
      this.m_type = b2Body.e_dynamicType;
    }
    if (oldType !== this.m_type) {
      s = this.m_shapeList;
      while (s) {
        s.RefilterProxy(this.m_world.m_broadPhase, this.m_xf);
        s = s.m_next;
      }
    }
  }

  // b2Body.as:341-393
  public SetXForm(position: b2Vec2 | null, angle: number): boolean {
    if (this.m_world.m_lock === true) {
      return true;
    }
    if (this.IsFrozen()) {
      return false;
    }
    this.m_xf.R.Set(angle);
    if (position != null) {
      this.m_xf.position.SetV(position);
    }
    const tMat: b2Mat22 = this.m_xf.R;
    const tVec: b2Vec2 = this.m_sweep.localCenter;
    this.m_sweep.c.x = tMat.col1.x * tVec.x + tMat.col2.x * tVec.y;
    this.m_sweep.c.y = tMat.col1.y * tVec.x + tMat.col2.y * tVec.y;
    this.m_sweep.c.x += this.m_xf.position.x;
    this.m_sweep.c.y += this.m_xf.position.y;
    this.m_sweep.c0.SetV(this.m_sweep.c);
    this.m_sweep.a0 = this.m_sweep.a = angle;
    let freeze: boolean = false;
    let s: b2Shape | null = this.m_shapeList;
    while (s) {
      const inRange: boolean = s.Synchronize(this.m_world.m_broadPhase, this.m_xf, this.m_xf);
      if (inRange === false) {
        freeze = true;
        break;
      }
      s = s.m_next;
    }
    if (freeze === true) {
      this.m_flags |= b2Body.e_frozenFlag;
      this.m_linearVelocity.SetZero();
      this.m_angularVelocity = 0;
      s = this.m_shapeList;
      while (s) {
        s.DestroyProxy(this.m_world.m_broadPhase);
        s = s.m_next;
      }
      return false;
    }
    this.m_world.m_broadPhase.Commit();
    return true;
  }

  // b2Body.as:395-398
  public GetXForm(): b2XForm {
    return this.m_xf;
  }

  // b2Body.as:400-403
  public GetPosition(): b2Vec2 {
    return this.m_xf.position;
  }

  // b2Body.as:405-408
  public GetAngle(): number {
    return this.m_sweep.a;
  }

  // b2Body.as:410-413
  public GetWorldCenter(): b2Vec2 {
    return this.m_sweep.c;
  }

  // b2Body.as:415-418
  public GetLocalCenter(): b2Vec2 {
    return this.m_sweep.localCenter;
  }

  // b2Body.as:420-423
  public SetLinearVelocity(v: b2Vec2): void {
    this.m_linearVelocity.SetV(v);
  }

  // b2Body.as:425-428
  public GetLinearVelocity(): b2Vec2 {
    return this.m_linearVelocity;
  }

  // b2Body.as:430-433
  public SetAngularVelocity(omega: number): void {
    this.m_angularVelocity = omega;
  }

  // b2Body.as:435-438
  public GetAngularVelocity(): number {
    return this.m_angularVelocity;
  }

  // b2Body.as:440-449
  public ApplyForce(force: b2Vec2, point: b2Vec2): void {
    if (this.IsSleeping()) {
      this.WakeUp();
    }
    this.m_force.x += force.x;
    this.m_force.y += force.y;
    this.m_torque += (point.x - this.m_sweep.c.x) * force.y - (point.y - this.m_sweep.c.y) * force.x;
  }

  // b2Body.as:451-458
  public ApplyTorque(torque: number): void {
    if (this.IsSleeping()) {
      this.WakeUp();
    }
    this.m_torque += torque;
  }

  // b2Body.as:460-469
  public ApplyImpulse(impulse: b2Vec2, point: b2Vec2): void {
    if (this.IsSleeping()) {
      this.WakeUp();
    }
    this.m_linearVelocity.x += this.m_invMass * impulse.x;
    this.m_linearVelocity.y += this.m_invMass * impulse.y;
    this.m_angularVelocity +=
      this.m_invI * ((point.x - this.m_sweep.c.x) * impulse.y - (point.y - this.m_sweep.c.y) * impulse.x);
  }

  // b2Body.as:471-474
  public GetMass(): number {
    return this.m_mass;
  }

  // b2Body.as:476-479
  public GetInertia(): number {
    return this.m_I;
  }

  // b2Body.as:481-488
  public GetWorldPoint(localPoint: b2Vec2): b2Vec2 {
    const tMat: b2Mat22 = this.m_xf.R;
    const v: b2Vec2 = new b2Vec2(
      tMat.col1.x * localPoint.x + tMat.col2.x * localPoint.y,
      tMat.col1.y * localPoint.x + tMat.col2.y * localPoint.y,
    );
    v.x += this.m_xf.position.x;
    v.y += this.m_xf.position.y;
    return v;
  }

  // b2Body.as:490-493
  public GetWorldVector(localVector: b2Vec2): b2Vec2 {
    return b2Math.b2MulMV(this.m_xf.R, localVector);
  }

  // b2Body.as:495-498
  public GetLocalPoint(worldPoint: b2Vec2): b2Vec2 {
    return b2Math.b2MulXT(this.m_xf, worldPoint);
  }

  // b2Body.as:500-503
  public GetLocalVector(worldVector: b2Vec2): b2Vec2 {
    return b2Math.b2MulTMV(this.m_xf.R, worldVector);
  }

  // b2Body.as:505-508 (note: faithful to the AS3, which has a known typo using
  // m_linearVelocity.x twice — preserved deliberately, never "fixed")
  public GetLinearVelocityFromWorldPoint(worldPoint: b2Vec2): b2Vec2 {
    return new b2Vec2(
      this.m_linearVelocity.x + this.m_angularVelocity * (worldPoint.y - this.m_sweep.c.y),
      this.m_linearVelocity.x - this.m_angularVelocity * (worldPoint.x - this.m_sweep.c.x),
    );
  }

  // b2Body.as:510-517 (same preserved AS3 typo: m_linearVelocity.x twice)
  public GetLinearVelocityFromLocalPoint(localPoint: b2Vec2): b2Vec2 {
    const tMat: b2Mat22 = this.m_xf.R;
    const v: b2Vec2 = new b2Vec2(
      tMat.col1.x * localPoint.x + tMat.col2.x * localPoint.y,
      tMat.col1.y * localPoint.x + tMat.col2.y * localPoint.y,
    );
    v.x += this.m_xf.position.x;
    v.y += this.m_xf.position.y;
    return new b2Vec2(
      this.m_linearVelocity.x + this.m_angularVelocity * (v.y - this.m_sweep.c.y),
      this.m_linearVelocity.x - this.m_angularVelocity * (v.x - this.m_sweep.c.x),
    );
  }

  // b2Body.as:519-522
  public IsBullet(): boolean {
    return (this.m_flags & b2Body.e_bulletFlag) === b2Body.e_bulletFlag;
  }

  // b2Body.as:524-534
  public SetBullet(flag: boolean): void {
    if (flag) {
      this.m_flags |= b2Body.e_bulletFlag;
    } else {
      this.m_flags &= ~b2Body.e_bulletFlag;
    }
  }

  // b2Body.as:536-546
  public SetUpright(flag: boolean): void {
    if (flag) {
      this.m_flags |= b2Body.e_fixedRotationFlag;
    } else {
      this.m_flags &= ~b2Body.e_fixedRotationFlag;
    }
  }

  // b2Body.as:548-551
  public IsStatic(): boolean {
    return this.m_type === b2Body.e_staticType;
  }

  // b2Body.as:553-556
  public IsDynamic(): boolean {
    return this.m_type === b2Body.e_dynamicType;
  }

  // b2Body.as:558-561
  public IsFrozen(): boolean {
    return (this.m_flags & b2Body.e_frozenFlag) === b2Body.e_frozenFlag;
  }

  // b2Body.as:563-566
  public IsSleeping(): boolean {
    return (this.m_flags & b2Body.e_sleepFlag) === b2Body.e_sleepFlag;
  }

  // b2Body.as:568-579
  public AllowSleeping(flag: boolean): void {
    if (flag) {
      this.m_flags |= b2Body.e_allowSleepFlag;
    } else {
      this.m_flags &= ~b2Body.e_allowSleepFlag;
      this.WakeUp();
    }
  }

  // b2Body.as:581-585
  public WakeUp(): void {
    this.m_flags &= ~b2Body.e_sleepFlag;
    this.m_sleepTime = 0;
  }

  // b2Body.as:587-595
  public PutToSleep(): void {
    this.m_flags |= b2Body.e_sleepFlag;
    this.m_sleepTime = 0;
    this.m_linearVelocity.SetZero();
    this.m_angularVelocity = 0;
    this.m_force.SetZero();
    this.m_torque = 0;
  }

  // b2Body.as:597-600
  public GetShapeList(): b2Shape | null {
    return this.m_shapeList;
  }

  // b2Body.as:602-605
  public GetJointList(): b2JointEdge | null {
    return this.m_jointList;
  }

  // b2Body.as:607-610
  public GetNext(): b2Body | null {
    return this.m_next;
  }

  // b2Body.as:612-615
  public GetUserData(): unknown {
    return this.m_userData;
  }

  // b2Body.as:617-620
  public SetUserData(data: unknown): void {
    this.m_userData = data;
  }

  // b2Body.as:622-625
  public GetWorld(): b2World {
    return this.m_world;
  }

  // b2Body.as:627-661
  public SynchronizeShapes(): boolean {
    const xf1: b2XForm = b2Body.s_xf1;
    xf1.R.Set(this.m_sweep.a0);
    const tMat: b2Mat22 = xf1.R;
    const tVec: b2Vec2 = this.m_sweep.localCenter;
    xf1.position.x = this.m_sweep.c0.x - (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    xf1.position.y = this.m_sweep.c0.y - (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
    let inRange: boolean = true;
    let s: b2Shape | null = this.m_shapeList;
    while (s) {
      inRange = s.Synchronize(this.m_world.m_broadPhase, xf1, this.m_xf);
      if (inRange === false) {
        break;
      }
      s = s.m_next;
    }
    if (inRange === false) {
      this.m_flags |= b2Body.e_frozenFlag;
      this.m_linearVelocity.SetZero();
      this.m_angularVelocity = 0;
      s = this.m_shapeList;
      while (s) {
        s.DestroyProxy(this.m_world.m_broadPhase);
        s = s.m_next;
      }
      return false;
    }
    return true;
  }

  // b2Body.as:663-670
  public SynchronizeTransform(): void {
    this.m_xf.R.Set(this.m_sweep.a);
    const tMat: b2Mat22 = this.m_xf.R;
    const tVec: b2Vec2 = this.m_sweep.localCenter;
    this.m_xf.position.x = this.m_sweep.c.x - (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    this.m_xf.position.y = this.m_sweep.c.y - (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
  }

  // b2Body.as:672-684
  public IsConnected(other: b2Body): boolean {
    let jn: b2JointEdge | null = this.m_jointList;
    while (jn) {
      if (jn.other === other) {
        return jn.joint!.m_collideConnected === false;
      }
      jn = jn.next;
    }
    return false;
  }

  // b2Body.as:686-692
  public Advance(t: number): void {
    this.m_sweep.Advance(t);
    this.m_sweep.c.SetV(this.m_sweep.c0);
    this.m_sweep.a = this.m_sweep.a0;
    this.SynchronizeTransform();
  }
}
