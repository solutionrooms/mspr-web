// Port of Box2D/Dynamics/Joints/b2MouseJoint.as (Box2DFlash 2.0.2), line-by-line.
// A soft 2-DOF spring from body2's anchor to a moving target (drag joint), with the
// characteristic 0.98 angular-velocity bleed each step. Op order preserved exactly.
import { b2Joint } from "./b2Joint";
import { b2MouseJointDef } from "./b2MouseJointDef";
import { b2Mat22 } from "../../Common/Math/b2Mat22";
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import { b2Settings } from "../../Common/b2Settings";
import type { b2Body } from "../b2Body";
import type { b2TimeStep } from "../b2TimeStep";
import { registerJointType } from "./_jointFactory";

export class b2MouseJoint extends b2Joint {
  private K: b2Mat22;
  private K1: b2Mat22;
  private K2: b2Mat22;
  public m_localAnchor: b2Vec2;
  public m_target: b2Vec2;
  public m_impulse: b2Vec2;
  public m_mass: b2Mat22;
  public m_C: b2Vec2;
  public m_maxForce!: number;
  public m_beta!: number;
  public m_gamma!: number;

  // b2MouseJoint.as:32-66
  constructor(def: b2MouseJointDef) {
    super(def);
    this.K = new b2Mat22();
    this.K1 = new b2Mat22();
    this.K2 = new b2Mat22();
    this.m_localAnchor = new b2Vec2();
    this.m_target = new b2Vec2();
    this.m_impulse = new b2Vec2();
    this.m_mass = new b2Mat22();
    this.m_C = new b2Vec2();
    this.m_target.SetV(def.target);
    const dX: number = this.m_target.x - this.m_body2.m_xf.position.x;
    const dY: number = this.m_target.y - this.m_body2.m_xf.position.y;
    const tMat: b2Mat22 = this.m_body2.m_xf.R;
    this.m_localAnchor.x = dX * tMat.col1.x + dY * tMat.col1.y;
    this.m_localAnchor.y = dX * tMat.col2.x + dY * tMat.col2.y;
    this.m_maxForce = def.maxForce;
    this.m_impulse.SetZero();
    const mass: number = this.m_body2.m_mass;
    const omega: number = 2 * b2Settings.b2_pi * def.frequencyHz;
    const d: number = 2 * mass * def.dampingRatio * omega;
    const k: number = def.timeStep * mass * (omega * omega);
    this.m_gamma = 1 / (d + k);
    this.m_beta = k / (d + k);
  }

  // b2MouseJoint.as:68-86
  public override GetAnchor1(): b2Vec2 {
    return this.m_target;
  }
  public override GetAnchor2(): b2Vec2 {
    return this.m_body2.GetWorldPoint(this.m_localAnchor);
  }
  public override GetReactionForce(): b2Vec2 {
    return this.m_impulse;
  }
  public override GetReactionTorque(): number {
    return 0;
  }

  // b2MouseJoint.as:88-94
  public SetTarget(target: b2Vec2): void {
    if (this.m_body2.IsSleeping()) {
      this.m_body2.WakeUp();
    }
    this.m_target = target;
  }

  // b2MouseJoint.as:96-129
  public override InitVelocityConstraints(step: b2TimeStep): void {
    const b: b2Body = this.m_body2;
    const tMat: b2Mat22 = b.m_xf.R;
    let rX: number = this.m_localAnchor.x - b.m_sweep.localCenter.x;
    let rY: number = this.m_localAnchor.y - b.m_sweep.localCenter.y;
    const tX: number = tMat.col1.x * rX + tMat.col2.x * rY;
    rY = tMat.col1.y * rX + tMat.col2.y * rY;
    rX = tX;
    const invMass: number = b.m_invMass;
    const invI: number = b.m_invI;
    this.K1.col1.x = invMass;
    this.K1.col2.x = 0;
    this.K1.col1.y = 0;
    this.K1.col2.y = invMass;
    this.K2.col1.x = invI * rY * rY;
    this.K2.col2.x = -invI * rX * rY;
    this.K2.col1.y = -invI * rX * rY;
    this.K2.col2.y = invI * rX * rX;
    this.K.SetM(this.K1);
    this.K.AddM(this.K2);
    this.K.col1.x += this.m_gamma;
    this.K.col2.y += this.m_gamma;
    this.K.Invert(this.m_mass);
    this.m_C.x = b.m_sweep.c.x + rX - this.m_target.x;
    this.m_C.y = b.m_sweep.c.y + rY - this.m_target.y;
    b.m_angularVelocity *= 0.98;
    const PX: number = step.dt * this.m_impulse.x;
    const PY: number = step.dt * this.m_impulse.y;
    b.m_linearVelocity.x += invMass * PX;
    b.m_linearVelocity.y += invMass * PY;
    b.m_angularVelocity += invI * (rX * PY - rY * PX);
  }

  // b2MouseJoint.as:131-167
  public override SolveVelocityConstraints(step: b2TimeStep): void {
    const b: b2Body = this.m_body2;
    const tMat: b2Mat22 = b.m_xf.R;
    let rX: number = this.m_localAnchor.x - b.m_sweep.localCenter.x;
    let rY: number = this.m_localAnchor.y - b.m_sweep.localCenter.y;
    let tX: number = tMat.col1.x * rX + tMat.col2.x * rY;
    rY = tMat.col1.y * rX + tMat.col2.y * rY;
    rX = tX;
    const CdotX: number = b.m_linearVelocity.x + -b.m_angularVelocity * rY;
    const CdotY: number = b.m_linearVelocity.y + b.m_angularVelocity * rX;
    const mass: b2Mat22 = this.m_mass;
    const aX: number = CdotX + this.m_beta * step.inv_dt * this.m_C.x + this.m_gamma * step.dt * this.m_impulse.x;
    const aY: number = CdotY + this.m_beta * step.inv_dt * this.m_C.y + this.m_gamma * step.dt * this.m_impulse.y;
    let impulseX: number = -step.inv_dt * (mass.col1.x * aX + mass.col2.x * aY);
    let impulseY: number = -step.inv_dt * (mass.col1.y * aX + mass.col2.y * aY);
    const oldImpulseX: number = this.m_impulse.x;
    const oldImpulseY: number = this.m_impulse.y;
    this.m_impulse.x += impulseX;
    this.m_impulse.y += impulseY;
    const length: number = this.m_impulse.Length();
    if (length > this.m_maxForce) {
      this.m_impulse.Multiply(this.m_maxForce / length);
    }
    impulseX = this.m_impulse.x - oldImpulseX;
    impulseY = this.m_impulse.y - oldImpulseY;
    const PX: number = step.dt * impulseX;
    const PY: number = step.dt * impulseY;
    b.m_linearVelocity.x += b.m_invMass * PX;
    b.m_linearVelocity.y += b.m_invMass * PY;
    b.m_angularVelocity += b.m_invI * (rX * PY - rY * PX);
  }

  // b2MouseJoint.as:169-172
  public override SolvePositionConstraints(): boolean {
    return true;
  }
}

registerJointType(b2Joint.e_mouseJoint, (def) => new b2MouseJoint(def as b2MouseJointDef));
