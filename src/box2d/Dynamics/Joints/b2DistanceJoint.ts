// Port of Box2D/Dynamics/Joints/b2DistanceJoint.as (Box2DFlash 2.0.2), line-by-line.
// Single scalar distance constraint (impulse-based), with optional soft constraint
// (frequencyHz/dampingRatio → gamma/bias). Op order preserved exactly.
import { b2Joint } from "./b2Joint";
import { b2DistanceJointDef } from "./b2DistanceJointDef";
import { b2Math } from "../../Common/Math/b2Math";
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import { b2Settings } from "../../Common/b2Settings";
import type { b2Mat22 } from "../../Common/Math/b2Mat22";
import type { b2Body } from "../b2Body";
import type { b2TimeStep } from "../b2TimeStep";
import { registerJointType } from "./_jointFactory";

export class b2DistanceJoint extends b2Joint {
  public m_localAnchor1: b2Vec2;
  public m_localAnchor2: b2Vec2;
  public m_u: b2Vec2;
  public m_frequencyHz!: number;
  public m_dampingRatio!: number;
  public m_gamma!: number;
  public m_bias!: number;
  public m_impulse!: number;
  public m_mass!: number;
  public m_length!: number;

  // b2DistanceJoint.as:38-58
  constructor(def: b2DistanceJointDef) {
    super(def);
    this.m_localAnchor1 = new b2Vec2();
    this.m_localAnchor2 = new b2Vec2();
    this.m_u = new b2Vec2();
    this.m_localAnchor1.SetV(def.localAnchor1);
    this.m_localAnchor2.SetV(def.localAnchor2);
    this.m_length = def.length;
    this.m_frequencyHz = def.frequencyHz;
    this.m_dampingRatio = def.dampingRatio;
    this.m_impulse = 0;
    this.m_gamma = 0;
    this.m_bias = 0;
    this.m_inv_dt = 0;
  }

  // b2DistanceJoint.as:60-130
  public override InitVelocityConstraints(step: b2TimeStep): void {
    this.m_inv_dt = step.inv_dt;
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
    this.m_u.x = b2.m_sweep.c.x + r2X - b1.m_sweep.c.x - r1X;
    this.m_u.y = b2.m_sweep.c.y + r2Y - b1.m_sweep.c.y - r1Y;
    const length: number = Math.sqrt(this.m_u.x * this.m_u.x + this.m_u.y * this.m_u.y);
    if (length > b2Settings.b2_linearSlop) {
      this.m_u.Multiply(1 / length);
    } else {
      this.m_u.SetZero();
    }
    const cr1u: number = r1X * this.m_u.y - r1Y * this.m_u.x;
    const cr2u: number = r2X * this.m_u.y - r2Y * this.m_u.x;
    const invMass: number = b1.m_invMass + b1.m_invI * cr1u * cr1u + b2.m_invMass + b2.m_invI * cr2u * cr2u;
    this.m_mass = 1 / invMass;
    if (this.m_frequencyHz > 0) {
      const C: number = length - this.m_length;
      const omega: number = 2 * Math.PI * this.m_frequencyHz;
      const d: number = 2 * this.m_mass * this.m_dampingRatio * omega;
      const k: number = this.m_mass * omega * omega;
      this.m_gamma = 1 / (step.dt * (d + step.dt * k));
      this.m_bias = C * step.dt * k * this.m_gamma;
      this.m_mass = 1 / (invMass + this.m_gamma);
    }
    if (step.warmStarting) {
      this.m_impulse *= step.dtRatio;
      const PX: number = this.m_impulse * this.m_u.x;
      const PY: number = this.m_impulse * this.m_u.y;
      b1.m_linearVelocity.x -= b1.m_invMass * PX;
      b1.m_linearVelocity.y -= b1.m_invMass * PY;
      b1.m_angularVelocity -= b1.m_invI * (r1X * PY - r1Y * PX);
      b2.m_linearVelocity.x += b2.m_invMass * PX;
      b2.m_linearVelocity.y += b2.m_invMass * PY;
      b2.m_angularVelocity += b2.m_invI * (r2X * PY - r2Y * PX);
    } else {
      this.m_impulse = 0;
    }
  }

  // b2DistanceJoint.as:132-167
  public override SolveVelocityConstraints(_step: b2TimeStep): void {
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
    const v1X: number = b1.m_linearVelocity.x + -b1.m_angularVelocity * r1Y;
    const v1Y: number = b1.m_linearVelocity.y + b1.m_angularVelocity * r1X;
    const v2X: number = b2.m_linearVelocity.x + -b2.m_angularVelocity * r2Y;
    const v2Y: number = b2.m_linearVelocity.y + b2.m_angularVelocity * r2X;
    const Cdot: number = this.m_u.x * (v2X - v1X) + this.m_u.y * (v2Y - v1Y);
    const impulse: number = -this.m_mass * (Cdot + this.m_bias + this.m_gamma * this.m_impulse);
    this.m_impulse += impulse;
    const PX: number = impulse * this.m_u.x;
    const PY: number = impulse * this.m_u.y;
    b1.m_linearVelocity.x -= b1.m_invMass * PX;
    b1.m_linearVelocity.y -= b1.m_invMass * PY;
    b1.m_angularVelocity -= b1.m_invI * (r1X * PY - r1Y * PX);
    b2.m_linearVelocity.x += b2.m_invMass * PX;
    b2.m_linearVelocity.y += b2.m_invMass * PY;
    b2.m_angularVelocity += b2.m_invI * (r2X * PY - r2Y * PX);
  }

  // b2DistanceJoint.as:169-211
  public override SolvePositionConstraints(): boolean {
    if (this.m_frequencyHz > 0) {
      return true;
    }
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
    let dX: number = b2.m_sweep.c.x + r2X - b1.m_sweep.c.x - r1X;
    let dY: number = b2.m_sweep.c.y + r2Y - b1.m_sweep.c.y - r1Y;
    const length: number = Math.sqrt(dX * dX + dY * dY);
    dX /= length;
    dY /= length;
    let C: number = length - this.m_length;
    C = b2Math.b2Clamp(C, -b2Settings.b2_maxLinearCorrection, b2Settings.b2_maxLinearCorrection);
    const impulse: number = -this.m_mass * C;
    this.m_u.Set(dX, dY);
    const PX: number = impulse * this.m_u.x;
    const PY: number = impulse * this.m_u.y;
    b1.m_sweep.c.x -= b1.m_invMass * PX;
    b1.m_sweep.c.y -= b1.m_invMass * PY;
    b1.m_sweep.a -= b1.m_invI * (r1X * PY - r1Y * PX);
    b2.m_sweep.c.x += b2.m_invMass * PX;
    b2.m_sweep.c.y += b2.m_invMass * PY;
    b2.m_sweep.a += b2.m_invI * (r2X * PY - r2Y * PX);
    b1.SynchronizeTransform();
    b2.SynchronizeTransform();
    return b2Math.b2Abs(C) < b2Settings.b2_linearSlop;
  }

  // b2DistanceJoint.as:213-235
  public override GetAnchor1(): b2Vec2 {
    return this.m_body1.GetWorldPoint(this.m_localAnchor1);
  }
  public override GetAnchor2(): b2Vec2 {
    return this.m_body2.GetWorldPoint(this.m_localAnchor2);
  }
  public override GetReactionForce(): b2Vec2 {
    const F: b2Vec2 = new b2Vec2();
    F.SetV(this.m_u);
    F.Multiply(this.m_inv_dt * this.m_impulse);
    return F;
  }
  public override GetReactionTorque(): number {
    return 0;
  }
}

registerJointType(b2Joint.e_distanceJoint, (def) => new b2DistanceJoint(def as b2DistanceJointDef));
