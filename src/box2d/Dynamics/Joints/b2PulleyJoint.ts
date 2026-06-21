// Port of Box2D/Dynamics/Joints/b2PulleyJoint.as (Box2DFlash 2.0.2), line-by-line.
// 2.0.x FORCE-based pulley: a length constraint (length1 + ratio·length2 = const) plus
// per-side max-length limits, against a ground anchor. Op order preserved exactly.
// (Unused by FZ3, ported for completeness.)
import { b2Joint } from "./b2Joint";
import type { b2PulleyJointDef } from "./b2PulleyJointDef";
import { b2Math } from "../../Common/Math/b2Math";
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import { b2Settings } from "../../Common/b2Settings";
import type { b2Mat22 } from "../../Common/Math/b2Mat22";
import type { b2Body } from "../b2Body";
import type { b2TimeStep } from "../b2TimeStep";
import { registerJointType } from "./_jointFactory";

export class b2PulleyJoint extends b2Joint {
  public static readonly b2_minPulleyLength: number = 2;

  public m_ground!: b2Body;
  public m_groundAnchor1: b2Vec2;
  public m_groundAnchor2: b2Vec2;
  public m_localAnchor1: b2Vec2;
  public m_localAnchor2: b2Vec2;
  public m_u1: b2Vec2;
  public m_u2: b2Vec2;
  public m_constant!: number;
  public m_ratio!: number;
  public m_maxLength1!: number;
  public m_maxLength2!: number;
  public m_pulleyMass!: number;
  public m_limitMass1!: number;
  public m_limitMass2!: number;
  public m_force!: number;
  public m_limitForce1!: number;
  public m_limitForce2!: number;
  public m_positionImpulse!: number;
  public m_limitPositionImpulse1!: number;
  public m_limitPositionImpulse2!: number;
  public m_state!: number;
  public m_limitState1!: number;
  public m_limitState2!: number;

  // b2PulleyJoint.as:61-87
  constructor(def: b2PulleyJointDef) {
    super(def);
    this.m_groundAnchor1 = new b2Vec2();
    this.m_groundAnchor2 = new b2Vec2();
    this.m_localAnchor1 = new b2Vec2();
    this.m_localAnchor2 = new b2Vec2();
    this.m_u1 = new b2Vec2();
    this.m_u2 = new b2Vec2();
    this.m_ground = this.m_body1.m_world.m_groundBody;
    this.m_groundAnchor1.x = def.groundAnchor1.x - this.m_ground.m_xf.position.x;
    this.m_groundAnchor1.y = def.groundAnchor1.y - this.m_ground.m_xf.position.y;
    this.m_groundAnchor2.x = def.groundAnchor2.x - this.m_ground.m_xf.position.x;
    this.m_groundAnchor2.y = def.groundAnchor2.y - this.m_ground.m_xf.position.y;
    this.m_localAnchor1.SetV(def.localAnchor1);
    this.m_localAnchor2.SetV(def.localAnchor2);
    this.m_ratio = def.ratio;
    this.m_constant = def.length1 + this.m_ratio * def.length2;
    this.m_maxLength1 = b2Math.b2Min(def.maxLength1, this.m_constant - this.m_ratio * b2PulleyJoint.b2_minPulleyLength);
    this.m_maxLength2 = b2Math.b2Min(def.maxLength2, (this.m_constant - b2PulleyJoint.b2_minPulleyLength) / this.m_ratio);
    this.m_force = 0;
    this.m_limitForce1 = 0;
    this.m_limitForce2 = 0;
  }

  // b2PulleyJoint.as:89-148
  public override GetAnchor1(): b2Vec2 {
    return this.m_body1.GetWorldPoint(this.m_localAnchor1);
  }
  public override GetAnchor2(): b2Vec2 {
    return this.m_body2.GetWorldPoint(this.m_localAnchor2);
  }
  public override GetReactionForce(): b2Vec2 {
    const F: b2Vec2 = this.m_u2.Copy();
    F.Multiply(this.m_force);
    return F;
  }
  public override GetReactionTorque(): number {
    return 0;
  }
  public GetGroundAnchor1(): b2Vec2 {
    const a: b2Vec2 = this.m_ground.m_xf.position.Copy();
    a.Add(this.m_groundAnchor1);
    return a;
  }
  public GetGroundAnchor2(): b2Vec2 {
    const a: b2Vec2 = this.m_ground.m_xf.position.Copy();
    a.Add(this.m_groundAnchor2);
    return a;
  }
  public GetLength1(): number {
    const p: b2Vec2 = this.m_body1.GetWorldPoint(this.m_localAnchor1);
    const sX: number = this.m_ground.m_xf.position.x + this.m_groundAnchor1.x;
    const sY: number = this.m_ground.m_xf.position.y + this.m_groundAnchor1.y;
    const dX: number = p.x - sX;
    const dY: number = p.y - sY;
    return Math.sqrt(dX * dX + dY * dY);
  }
  public GetLength2(): number {
    const p: b2Vec2 = this.m_body2.GetWorldPoint(this.m_localAnchor2);
    const sX: number = this.m_ground.m_xf.position.x + this.m_groundAnchor2.x;
    const sY: number = this.m_ground.m_xf.position.y + this.m_groundAnchor2.y;
    const dX: number = p.x - sX;
    const dY: number = p.y - sY;
    return Math.sqrt(dX * dX + dY * dY);
  }
  public GetRatio(): number {
    return this.m_ratio;
  }

  // b2PulleyJoint.as:150-257
  public override InitVelocityConstraints(step: b2TimeStep): void {
    const b1: b2Body = this.m_body1;
    const b2: b2Body = this.m_body2;
    let tMat: b2Mat22 = b1.m_xf.R;
    let r1X: number = this.m_localAnchor1.x - b1.m_sweep.localCenter.x;
    let r1Y: number = this.m_localAnchor1.y - b1.m_sweep.localCenter.y;
    let tX: number = tMat.col1.x * r1X + tMat.col2.x * r1Y;
    r1Y = tMat.col1.y * r1X + tMat.col2.y * r1Y;
    r1X = tX;
    tMat = b2.m_xf.R;
    let r2X: number = this.m_localAnchor2.x - b2.m_sweep.localCenter.x;
    let r2Y: number = this.m_localAnchor2.y - b2.m_sweep.localCenter.y;
    tX = tMat.col1.x * r2X + tMat.col2.x * r2Y;
    r2Y = tMat.col1.y * r2X + tMat.col2.y * r2Y;
    r2X = tX;
    const p1X: number = b1.m_sweep.c.x + r1X;
    const p1Y: number = b1.m_sweep.c.y + r1Y;
    const p2X: number = b2.m_sweep.c.x + r2X;
    const p2Y: number = b2.m_sweep.c.y + r2Y;
    const s1X: number = this.m_ground.m_xf.position.x + this.m_groundAnchor1.x;
    const s1Y: number = this.m_ground.m_xf.position.y + this.m_groundAnchor1.y;
    const s2X: number = this.m_ground.m_xf.position.x + this.m_groundAnchor2.x;
    const s2Y: number = this.m_ground.m_xf.position.y + this.m_groundAnchor2.y;
    this.m_u1.Set(p1X - s1X, p1Y - s1Y);
    this.m_u2.Set(p2X - s2X, p2Y - s2Y);
    const length1: number = this.m_u1.Length();
    const length2: number = this.m_u2.Length();
    if (length1 > b2Settings.b2_linearSlop) {
      this.m_u1.Multiply(1 / length1);
    } else {
      this.m_u1.SetZero();
    }
    if (length2 > b2Settings.b2_linearSlop) {
      this.m_u2.Multiply(1 / length2);
    } else {
      this.m_u2.SetZero();
    }
    const C: number = this.m_constant - length1 - this.m_ratio * length2;
    if (C > 0) {
      this.m_state = b2Joint.e_inactiveLimit;
      this.m_force = 0;
    } else {
      this.m_state = b2Joint.e_atUpperLimit;
      this.m_positionImpulse = 0;
    }
    if (length1 < this.m_maxLength1) {
      this.m_limitState1 = b2Joint.e_inactiveLimit;
      this.m_limitForce1 = 0;
    } else {
      this.m_limitState1 = b2Joint.e_atUpperLimit;
      this.m_limitPositionImpulse1 = 0;
    }
    if (length2 < this.m_maxLength2) {
      this.m_limitState2 = b2Joint.e_inactiveLimit;
      this.m_limitForce2 = 0;
    } else {
      this.m_limitState2 = b2Joint.e_atUpperLimit;
      this.m_limitPositionImpulse2 = 0;
    }
    const cr1u1: number = r1X * this.m_u1.y - r1Y * this.m_u1.x;
    const cr2u2: number = r2X * this.m_u2.y - r2Y * this.m_u2.x;
    this.m_limitMass1 = b1.m_invMass + b1.m_invI * cr1u1 * cr1u1;
    this.m_limitMass2 = b2.m_invMass + b2.m_invI * cr2u2 * cr2u2;
    this.m_pulleyMass = this.m_limitMass1 + this.m_ratio * this.m_ratio * this.m_limitMass2;
    this.m_limitMass1 = 1 / this.m_limitMass1;
    this.m_limitMass2 = 1 / this.m_limitMass2;
    this.m_pulleyMass = 1 / this.m_pulleyMass;
    if (step.warmStarting) {
      const P1X: number = step.dt * (-this.m_force - this.m_limitForce1) * this.m_u1.x;
      const P1Y: number = step.dt * (-this.m_force - this.m_limitForce1) * this.m_u1.y;
      const P2X: number = step.dt * (-this.m_ratio * this.m_force - this.m_limitForce2) * this.m_u2.x;
      const P2Y: number = step.dt * (-this.m_ratio * this.m_force - this.m_limitForce2) * this.m_u2.y;
      b1.m_linearVelocity.x += b1.m_invMass * P1X;
      b1.m_linearVelocity.y += b1.m_invMass * P1Y;
      b1.m_angularVelocity += b1.m_invI * (r1X * P1Y - r1Y * P1X);
      b2.m_linearVelocity.x += b2.m_invMass * P2X;
      b2.m_linearVelocity.y += b2.m_invMass * P2Y;
      b2.m_angularVelocity += b2.m_invI * (r2X * P2Y - r2Y * P2X);
    } else {
      this.m_force = 0;
      this.m_limitForce1 = 0;
      this.m_limitForce2 = 0;
    }
  }

  // b2PulleyJoint.as:259-339
  public override SolveVelocityConstraints(step: b2TimeStep): void {
    const b1: b2Body = this.m_body1;
    const b2: b2Body = this.m_body2;
    let tMat: b2Mat22 = b1.m_xf.R;
    let r1X: number = this.m_localAnchor1.x - b1.m_sweep.localCenter.x;
    let r1Y: number = this.m_localAnchor1.y - b1.m_sweep.localCenter.y;
    let tX: number = tMat.col1.x * r1X + tMat.col2.x * r1Y;
    r1Y = tMat.col1.y * r1X + tMat.col2.y * r1Y;
    r1X = tX;
    tMat = b2.m_xf.R;
    let r2X: number = this.m_localAnchor2.x - b2.m_sweep.localCenter.x;
    let r2Y: number = this.m_localAnchor2.y - b2.m_sweep.localCenter.y;
    tX = tMat.col1.x * r2X + tMat.col2.x * r2Y;
    r2Y = tMat.col1.y * r2X + tMat.col2.y * r2Y;
    r2X = tX;
    if (this.m_state === b2Joint.e_atUpperLimit) {
      const v1X: number = b1.m_linearVelocity.x + -b1.m_angularVelocity * r1Y;
      const v1Y: number = b1.m_linearVelocity.y + b1.m_angularVelocity * r1X;
      const v2X: number = b2.m_linearVelocity.x + -b2.m_angularVelocity * r2Y;
      const v2Y: number = b2.m_linearVelocity.y + b2.m_angularVelocity * r2X;
      const Cdot: number =
        -(this.m_u1.x * v1X + this.m_u1.y * v1Y) - this.m_ratio * (this.m_u2.x * v2X + this.m_u2.y * v2Y);
      let force: number = -step.inv_dt * this.m_pulleyMass * Cdot;
      const oldForce: number = this.m_force;
      this.m_force = b2Math.b2Max(0, this.m_force + force);
      force = this.m_force - oldForce;
      const P1X: number = -step.dt * force * this.m_u1.x;
      const P1Y: number = -step.dt * force * this.m_u1.y;
      const P2X: number = -step.dt * this.m_ratio * force * this.m_u2.x;
      const P2Y: number = -step.dt * this.m_ratio * force * this.m_u2.y;
      b1.m_linearVelocity.x += b1.m_invMass * P1X;
      b1.m_linearVelocity.y += b1.m_invMass * P1Y;
      b1.m_angularVelocity += b1.m_invI * (r1X * P1Y - r1Y * P1X);
      b2.m_linearVelocity.x += b2.m_invMass * P2X;
      b2.m_linearVelocity.y += b2.m_invMass * P2Y;
      b2.m_angularVelocity += b2.m_invI * (r2X * P2Y - r2Y * P2X);
    }
    if (this.m_limitState1 === b2Joint.e_atUpperLimit) {
      const v1X: number = b1.m_linearVelocity.x + -b1.m_angularVelocity * r1Y;
      const v1Y: number = b1.m_linearVelocity.y + b1.m_angularVelocity * r1X;
      const Cdot: number = -(this.m_u1.x * v1X + this.m_u1.y * v1Y);
      let force: number = -step.inv_dt * this.m_limitMass1 * Cdot;
      const oldForce: number = this.m_limitForce1;
      this.m_limitForce1 = b2Math.b2Max(0, this.m_limitForce1 + force);
      force = this.m_limitForce1 - oldForce;
      const P1X: number = -step.dt * force * this.m_u1.x;
      const P1Y: number = -step.dt * force * this.m_u1.y;
      b1.m_linearVelocity.x += b1.m_invMass * P1X;
      b1.m_linearVelocity.y += b1.m_invMass * P1Y;
      b1.m_angularVelocity += b1.m_invI * (r1X * P1Y - r1Y * P1X);
    }
    if (this.m_limitState2 === b2Joint.e_atUpperLimit) {
      const v2X: number = b2.m_linearVelocity.x + -b2.m_angularVelocity * r2Y;
      const v2Y: number = b2.m_linearVelocity.y + b2.m_angularVelocity * r2X;
      const Cdot: number = -(this.m_u2.x * v2X + this.m_u2.y * v2Y);
      let force: number = -step.inv_dt * this.m_limitMass2 * Cdot;
      const oldForce: number = this.m_limitForce2;
      this.m_limitForce2 = b2Math.b2Max(0, this.m_limitForce2 + force);
      force = this.m_limitForce2 - oldForce;
      const P2X: number = -step.dt * force * this.m_u2.x;
      const P2Y: number = -step.dt * force * this.m_u2.y;
      b2.m_linearVelocity.x += b2.m_invMass * P2X;
      b2.m_linearVelocity.y += b2.m_invMass * P2Y;
      b2.m_angularVelocity += b2.m_invI * (r2X * P2Y - r2Y * P2X);
    }
  }

  // b2PulleyJoint.as:341-495
  public override SolvePositionConstraints(): boolean {
    const b1: b2Body = this.m_body1;
    const b2: b2Body = this.m_body2;
    const s1X: number = this.m_ground.m_xf.position.x + this.m_groundAnchor1.x;
    const s1Y: number = this.m_ground.m_xf.position.y + this.m_groundAnchor1.y;
    const s2X: number = this.m_ground.m_xf.position.x + this.m_groundAnchor2.x;
    const s2Y: number = this.m_ground.m_xf.position.y + this.m_groundAnchor2.y;
    let linearError: number = 0;
    if (this.m_state === b2Joint.e_atUpperLimit) {
      let tMat: b2Mat22 = b1.m_xf.R;
      let r1X: number = this.m_localAnchor1.x - b1.m_sweep.localCenter.x;
      let r1Y: number = this.m_localAnchor1.y - b1.m_sweep.localCenter.y;
      let tX: number = tMat.col1.x * r1X + tMat.col2.x * r1Y;
      r1Y = tMat.col1.y * r1X + tMat.col2.y * r1Y;
      r1X = tX;
      tMat = b2.m_xf.R;
      let r2X: number = this.m_localAnchor2.x - b2.m_sweep.localCenter.x;
      let r2Y: number = this.m_localAnchor2.y - b2.m_sweep.localCenter.y;
      tX = tMat.col1.x * r2X + tMat.col2.x * r2Y;
      r2Y = tMat.col1.y * r2X + tMat.col2.y * r2Y;
      r2X = tX;
      const p1X: number = b1.m_sweep.c.x + r1X;
      const p1Y: number = b1.m_sweep.c.y + r1Y;
      const p2X: number = b2.m_sweep.c.x + r2X;
      const p2Y: number = b2.m_sweep.c.y + r2Y;
      this.m_u1.Set(p1X - s1X, p1Y - s1Y);
      this.m_u2.Set(p2X - s2X, p2Y - s2Y);
      const length1: number = this.m_u1.Length();
      const length2: number = this.m_u2.Length();
      if (length1 > b2Settings.b2_linearSlop) {
        this.m_u1.Multiply(1 / length1);
      } else {
        this.m_u1.SetZero();
      }
      if (length2 > b2Settings.b2_linearSlop) {
        this.m_u2.Multiply(1 / length2);
      } else {
        this.m_u2.SetZero();
      }
      let C: number = this.m_constant - length1 - this.m_ratio * length2;
      linearError = b2Math.b2Max(linearError, -C);
      C = b2Math.b2Clamp(C + b2Settings.b2_linearSlop, -b2Settings.b2_maxLinearCorrection, 0);
      let impulse: number = -this.m_pulleyMass * C;
      const oldImpulse: number = this.m_positionImpulse;
      this.m_positionImpulse = b2Math.b2Max(0, this.m_positionImpulse + impulse);
      impulse = this.m_positionImpulse - oldImpulse;
      const P1X: number = -impulse * this.m_u1.x;
      const P1Y: number = -impulse * this.m_u1.y;
      const P2X: number = -this.m_ratio * impulse * this.m_u2.x;
      const P2Y: number = -this.m_ratio * impulse * this.m_u2.y;
      b1.m_sweep.c.x += b1.m_invMass * P1X;
      b1.m_sweep.c.y += b1.m_invMass * P1Y;
      b1.m_sweep.a += b1.m_invI * (r1X * P1Y - r1Y * P1X);
      b2.m_sweep.c.x += b2.m_invMass * P2X;
      b2.m_sweep.c.y += b2.m_invMass * P2Y;
      b2.m_sweep.a += b2.m_invI * (r2X * P2Y - r2Y * P2X);
      b1.SynchronizeTransform();
      b2.SynchronizeTransform();
    }
    if (this.m_limitState1 === b2Joint.e_atUpperLimit) {
      let tMat: b2Mat22 = b1.m_xf.R;
      let r1X: number = this.m_localAnchor1.x - b1.m_sweep.localCenter.x;
      let r1Y: number = this.m_localAnchor1.y - b1.m_sweep.localCenter.y;
      const tX: number = tMat.col1.x * r1X + tMat.col2.x * r1Y;
      r1Y = tMat.col1.y * r1X + tMat.col2.y * r1Y;
      r1X = tX;
      const p1X: number = b1.m_sweep.c.x + r1X;
      const p1Y: number = b1.m_sweep.c.y + r1Y;
      this.m_u1.Set(p1X - s1X, p1Y - s1Y);
      const length1: number = this.m_u1.Length();
      if (length1 > b2Settings.b2_linearSlop) {
        this.m_u1.x *= 1 / length1;
        this.m_u1.y *= 1 / length1;
      } else {
        this.m_u1.SetZero();
      }
      let C: number = this.m_maxLength1 - length1;
      linearError = b2Math.b2Max(linearError, -C);
      C = b2Math.b2Clamp(C + b2Settings.b2_linearSlop, -b2Settings.b2_maxLinearCorrection, 0);
      let impulse: number = -this.m_limitMass1 * C;
      const oldImpulse: number = this.m_limitPositionImpulse1;
      this.m_limitPositionImpulse1 = b2Math.b2Max(0, this.m_limitPositionImpulse1 + impulse);
      impulse = this.m_limitPositionImpulse1 - oldImpulse;
      const P1X: number = -impulse * this.m_u1.x;
      const P1Y: number = -impulse * this.m_u1.y;
      b1.m_sweep.c.x += b1.m_invMass * P1X;
      b1.m_sweep.c.y += b1.m_invMass * P1Y;
      b1.m_sweep.a += b1.m_invI * (r1X * P1Y - r1Y * P1X);
      b1.SynchronizeTransform();
    }
    if (this.m_limitState2 === b2Joint.e_atUpperLimit) {
      let tMat: b2Mat22 = b2.m_xf.R;
      let r2X: number = this.m_localAnchor2.x - b2.m_sweep.localCenter.x;
      let r2Y: number = this.m_localAnchor2.y - b2.m_sweep.localCenter.y;
      const tX: number = tMat.col1.x * r2X + tMat.col2.x * r2Y;
      r2Y = tMat.col1.y * r2X + tMat.col2.y * r2Y;
      r2X = tX;
      const p2X: number = b2.m_sweep.c.x + r2X;
      const p2Y: number = b2.m_sweep.c.y + r2Y;
      this.m_u2.Set(p2X - s2X, p2Y - s2Y);
      const length2: number = this.m_u2.Length();
      if (length2 > b2Settings.b2_linearSlop) {
        this.m_u2.x *= 1 / length2;
        this.m_u2.y *= 1 / length2;
      } else {
        this.m_u2.SetZero();
      }
      let C: number = this.m_maxLength2 - length2;
      linearError = b2Math.b2Max(linearError, -C);
      C = b2Math.b2Clamp(C + b2Settings.b2_linearSlop, -b2Settings.b2_maxLinearCorrection, 0);
      let impulse: number = -this.m_limitMass2 * C;
      const oldImpulse: number = this.m_limitPositionImpulse2;
      this.m_limitPositionImpulse2 = b2Math.b2Max(0, this.m_limitPositionImpulse2 + impulse);
      impulse = this.m_limitPositionImpulse2 - oldImpulse;
      const P2X: number = -impulse * this.m_u2.x;
      const P2Y: number = -impulse * this.m_u2.y;
      b2.m_sweep.c.x += b2.m_invMass * P2X;
      b2.m_sweep.c.y += b2.m_invMass * P2Y;
      b2.m_sweep.a += b2.m_invI * (r2X * P2Y - r2Y * P2X);
      b2.SynchronizeTransform();
    }
    return linearError < b2Settings.b2_linearSlop;
  }
}

registerJointType(b2Joint.e_pulleyJoint, (def) => new b2PulleyJoint(def as b2PulleyJointDef));
