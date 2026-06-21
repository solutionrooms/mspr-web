// Port of Box2D/Dynamics/Joints/b2RevoluteJoint.as (Box2DFlash 2.0.2), line-by-line.
// 2.0.x FORCE-based revolute: accumulates m_pivotForce/m_motorForce/m_limitForce scaled
// by inv_dt (NOT the impulse-based 2.1+ formulation). Op order preserved exactly.
import { b2Joint } from "./b2Joint";
import { b2RevoluteJointDef } from "./b2RevoluteJointDef";
import { b2Mat22 } from "../../Common/Math/b2Mat22";
import { b2Math } from "../../Common/Math/b2Math";
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import { b2Settings } from "../../Common/b2Settings";
import type { b2Body } from "../b2Body";
import type { b2TimeStep } from "../b2TimeStep";
import { registerJointType } from "./_jointFactory";

export class b2RevoluteJoint extends b2Joint {
  public static tImpulse: b2Vec2 = new b2Vec2();

  private K: b2Mat22 = new b2Mat22();
  private K1: b2Mat22 = new b2Mat22();
  private K2: b2Mat22 = new b2Mat22();
  private K3: b2Mat22 = new b2Mat22();

  public m_localAnchor1: b2Vec2 = new b2Vec2();
  public m_localAnchor2: b2Vec2 = new b2Vec2();
  public m_pivotForce: b2Vec2 = new b2Vec2();
  public m_motorForce!: number;
  public m_limitForce!: number;
  public m_limitPositionImpulse!: number;
  public m_pivotMass: b2Mat22 = new b2Mat22();
  public m_motorMass!: number;
  public m_enableMotor!: boolean;
  public m_maxMotorTorque!: number;
  public m_motorSpeed!: number;
  public m_enableLimit!: boolean;
  public m_referenceAngle!: number;
  public m_lowerAngle!: number;
  public m_upperAngle!: number;
  public m_limitState!: number;

  // b2RevoluteJoint.as:55-71
  constructor(def: b2RevoluteJointDef) {
    super(def);
    this.m_localAnchor1.SetV(def.localAnchor1);
    this.m_localAnchor2.SetV(def.localAnchor2);
    this.m_referenceAngle = def.referenceAngle;
    this.m_pivotForce.Set(0, 0);
    this.m_motorForce = 0;
    this.m_limitForce = 0;
    this.m_limitPositionImpulse = 0;
    this.m_lowerAngle = def.lowerAngle;
    this.m_upperAngle = def.upperAngle;
    this.m_maxMotorTorque = def.maxMotorTorque;
    this.m_motorSpeed = def.motorSpeed;
    this.m_enableLimit = def.enableLimit;
    this.m_enableMotor = def.enableMotor;
  }

  // b2RevoluteJoint.as:73-91
  public override GetAnchor1(): b2Vec2 {
    return this.m_body1.GetWorldPoint(this.m_localAnchor1);
  }
  public override GetAnchor2(): b2Vec2 {
    return this.m_body2.GetWorldPoint(this.m_localAnchor2);
  }
  public override GetReactionForce(): b2Vec2 {
    return this.m_pivotForce;
  }
  public override GetReactionTorque(): number {
    return this.m_limitForce;
  }
  public GetJointAngle(): number {
    return this.m_body2.m_sweep.a - this.m_body1.m_sweep.a - this.m_referenceAngle;
  }
  public GetJointSpeed(): number {
    return this.m_body2.m_angularVelocity - this.m_body1.m_angularVelocity;
  }
  public IsLimitEnabled(): boolean {
    return this.m_enableLimit;
  }
  public EnableLimit(flag: boolean): void {
    this.m_enableLimit = flag;
  }
  public GetLowerLimit(): number {
    return this.m_lowerAngle;
  }
  public GetUpperLimit(): number {
    return this.m_upperAngle;
  }
  public SetLimits(lower: number, upper: number): void {
    this.m_lowerAngle = lower;
    this.m_upperAngle = upper;
  }
  public IsMotorEnabled(): boolean {
    return this.m_enableMotor;
  }
  public EnableMotor(flag: boolean): void {
    this.m_enableMotor = flag;
  }
  public SetMotorSpeed(speed: number): void {
    this.m_motorSpeed = speed;
  }
  public GetMotorSpeed(): number {
    return this.m_motorSpeed;
  }
  public SetMaxMotorTorque(torque: number): void {
    this.m_maxMotorTorque = torque;
  }
  public GetMotorTorque(): number {
    return this.m_motorForce;
  }

  // b2RevoluteJoint.as:159-255
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
    const invMass1: number = b1.m_invMass;
    const invMass2: number = b2.m_invMass;
    const invI1: number = b1.m_invI;
    const invI2: number = b2.m_invI;
    this.K1.col1.x = invMass1 + invMass2;
    this.K1.col2.x = 0;
    this.K1.col1.y = 0;
    this.K1.col2.y = invMass1 + invMass2;
    this.K2.col1.x = invI1 * r1Y * r1Y;
    this.K2.col2.x = -invI1 * r1X * r1Y;
    this.K2.col1.y = -invI1 * r1X * r1Y;
    this.K2.col2.y = invI1 * r1X * r1X;
    this.K3.col1.x = invI2 * r2Y * r2Y;
    this.K3.col2.x = -invI2 * r2X * r2Y;
    this.K3.col1.y = -invI2 * r2X * r2Y;
    this.K3.col2.y = invI2 * r2X * r2X;
    this.K.SetM(this.K1);
    this.K.AddM(this.K2);
    this.K.AddM(this.K3);
    this.K.Invert(this.m_pivotMass);
    this.m_motorMass = 1 / (invI1 + invI2);
    if (this.m_enableMotor === false) {
      this.m_motorForce = 0;
    }
    if (this.m_enableLimit) {
      const jointAngle: number = b2.m_sweep.a - b1.m_sweep.a - this.m_referenceAngle;
      if (b2Math.b2Abs(this.m_upperAngle - this.m_lowerAngle) < 2 * b2Settings.b2_angularSlop) {
        this.m_limitState = b2Joint.e_equalLimits;
      } else if (jointAngle <= this.m_lowerAngle) {
        if (this.m_limitState !== b2Joint.e_atLowerLimit) {
          this.m_limitForce = 0;
        }
        this.m_limitState = b2Joint.e_atLowerLimit;
      } else if (jointAngle >= this.m_upperAngle) {
        if (this.m_limitState !== b2Joint.e_atUpperLimit) {
          this.m_limitForce = 0;
        }
        this.m_limitState = b2Joint.e_atUpperLimit;
      } else {
        this.m_limitState = b2Joint.e_inactiveLimit;
        this.m_limitForce = 0;
      }
    } else {
      this.m_limitForce = 0;
    }
    if (step.warmStarting) {
      b1.m_linearVelocity.x -= step.dt * invMass1 * this.m_pivotForce.x;
      b1.m_linearVelocity.y -= step.dt * invMass1 * this.m_pivotForce.y;
      b1.m_angularVelocity -=
        step.dt * invI1 * (r1X * this.m_pivotForce.y - r1Y * this.m_pivotForce.x + this.m_motorForce + this.m_limitForce);
      b2.m_linearVelocity.x += step.dt * invMass2 * this.m_pivotForce.x;
      b2.m_linearVelocity.y += step.dt * invMass2 * this.m_pivotForce.y;
      b2.m_angularVelocity +=
        step.dt * invI2 * (r2X * this.m_pivotForce.y - r2Y * this.m_pivotForce.x + this.m_motorForce + this.m_limitForce);
    } else {
      this.m_pivotForce.SetZero();
      this.m_motorForce = 0;
      this.m_limitForce = 0;
    }
    this.m_limitPositionImpulse = 0;
  }

  // b2RevoluteJoint.as:257-329
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
    const pivotCdotX: number =
      b2.m_linearVelocity.x + -b2.m_angularVelocity * r2Y - b1.m_linearVelocity.x - -b1.m_angularVelocity * r1Y;
    const pivotCdotY: number =
      b2.m_linearVelocity.y + b2.m_angularVelocity * r2X - b1.m_linearVelocity.y - b1.m_angularVelocity * r1X;
    const pivotForceX: number = -step.inv_dt * (this.m_pivotMass.col1.x * pivotCdotX + this.m_pivotMass.col2.x * pivotCdotY);
    const pivotForceY: number = -step.inv_dt * (this.m_pivotMass.col1.y * pivotCdotX + this.m_pivotMass.col2.y * pivotCdotY);
    this.m_pivotForce.x += pivotForceX;
    this.m_pivotForce.y += pivotForceY;
    const PX: number = step.dt * pivotForceX;
    const PY: number = step.dt * pivotForceY;
    b1.m_linearVelocity.x -= b1.m_invMass * PX;
    b1.m_linearVelocity.y -= b1.m_invMass * PY;
    b1.m_angularVelocity -= b1.m_invI * (r1X * PY - r1Y * PX);
    b2.m_linearVelocity.x += b2.m_invMass * PX;
    b2.m_linearVelocity.y += b2.m_invMass * PY;
    b2.m_angularVelocity += b2.m_invI * (r2X * PY - r2Y * PX);
    if (this.m_enableMotor && this.m_limitState !== b2Joint.e_equalLimits) {
      const motorCdot: number = b2.m_angularVelocity - b1.m_angularVelocity - this.m_motorSpeed;
      let motorForce: number = -step.inv_dt * this.m_motorMass * motorCdot;
      const oldMotorForce: number = this.m_motorForce;
      this.m_motorForce = b2Math.b2Clamp(this.m_motorForce + motorForce, -this.m_maxMotorTorque, this.m_maxMotorTorque);
      motorForce = this.m_motorForce - oldMotorForce;
      b1.m_angularVelocity -= b1.m_invI * step.dt * motorForce;
      b2.m_angularVelocity += b2.m_invI * step.dt * motorForce;
    }
    if (this.m_enableLimit && this.m_limitState !== b2Joint.e_inactiveLimit) {
      const limitCdot: number = b2.m_angularVelocity - b1.m_angularVelocity;
      let limitForce: number = -step.inv_dt * this.m_motorMass * limitCdot;
      if (this.m_limitState === b2Joint.e_equalLimits) {
        this.m_limitForce += limitForce;
      } else if (this.m_limitState === b2Joint.e_atLowerLimit) {
        const oldLimitForce: number = this.m_limitForce;
        this.m_limitForce = b2Math.b2Max(this.m_limitForce + limitForce, 0);
        limitForce = this.m_limitForce - oldLimitForce;
      } else if (this.m_limitState === b2Joint.e_atUpperLimit) {
        const oldLimitForce: number = this.m_limitForce;
        this.m_limitForce = b2Math.b2Min(this.m_limitForce + limitForce, 0);
        limitForce = this.m_limitForce - oldLimitForce;
      }
      b1.m_angularVelocity -= b1.m_invI * step.dt * limitForce;
      b2.m_angularVelocity += b2.m_invI * step.dt * limitForce;
    }
  }

  // b2RevoluteJoint.as:331-427
  public override SolvePositionConstraints(): boolean {
    const b1: b2Body = this.m_body1;
    const b2: b2Body = this.m_body2;
    let positionError: number = 0;
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
    const ptpX: number = p2X - p1X;
    const ptpY: number = p2Y - p1Y;
    positionError = Math.sqrt(ptpX * ptpX + ptpY * ptpY);
    const invMass1: number = b1.m_invMass;
    const invMass2: number = b2.m_invMass;
    const invI1: number = b1.m_invI;
    const invI2: number = b2.m_invI;
    this.K1.col1.x = invMass1 + invMass2;
    this.K1.col2.x = 0;
    this.K1.col1.y = 0;
    this.K1.col2.y = invMass1 + invMass2;
    this.K2.col1.x = invI1 * r1Y * r1Y;
    this.K2.col2.x = -invI1 * r1X * r1Y;
    this.K2.col1.y = -invI1 * r1X * r1Y;
    this.K2.col2.y = invI1 * r1X * r1X;
    this.K3.col1.x = invI2 * r2Y * r2Y;
    this.K3.col2.x = -invI2 * r2X * r2Y;
    this.K3.col1.y = -invI2 * r2X * r2Y;
    this.K3.col2.y = invI2 * r2X * r2X;
    this.K.SetM(this.K1);
    this.K.AddM(this.K2);
    this.K.AddM(this.K3);
    this.K.Solve(b2RevoluteJoint.tImpulse, -ptpX, -ptpY);
    const impulseX: number = b2RevoluteJoint.tImpulse.x;
    const impulseY: number = b2RevoluteJoint.tImpulse.y;
    b1.m_sweep.c.x -= b1.m_invMass * impulseX;
    b1.m_sweep.c.y -= b1.m_invMass * impulseY;
    b1.m_sweep.a -= b1.m_invI * (r1X * impulseY - r1Y * impulseX);
    b2.m_sweep.c.x += b2.m_invMass * impulseX;
    b2.m_sweep.c.y += b2.m_invMass * impulseY;
    b2.m_sweep.a += b2.m_invI * (r2X * impulseY - r2Y * impulseX);
    b1.SynchronizeTransform();
    b2.SynchronizeTransform();
    let angularError: number = 0;
    if (this.m_enableLimit && this.m_limitState !== b2Joint.e_inactiveLimit) {
      const angle: number = b2.m_sweep.a - b1.m_sweep.a - this.m_referenceAngle;
      let limitImpulse: number = 0;
      if (this.m_limitState === b2Joint.e_equalLimits) {
        const limitC: number = b2Math.b2Clamp(angle, -b2Settings.b2_maxAngularCorrection, b2Settings.b2_maxAngularCorrection);
        limitImpulse = -this.m_motorMass * limitC;
        angularError = b2Math.b2Abs(limitC);
      } else if (this.m_limitState === b2Joint.e_atLowerLimit) {
        let limitC: number = angle - this.m_lowerAngle;
        angularError = b2Math.b2Max(0, -limitC);
        limitC = b2Math.b2Clamp(limitC + b2Settings.b2_angularSlop, -b2Settings.b2_maxAngularCorrection, 0);
        limitImpulse = -this.m_motorMass * limitC;
        const oldLimitImpulse: number = this.m_limitPositionImpulse;
        this.m_limitPositionImpulse = b2Math.b2Max(this.m_limitPositionImpulse + limitImpulse, 0);
        limitImpulse = this.m_limitPositionImpulse - oldLimitImpulse;
      } else if (this.m_limitState === b2Joint.e_atUpperLimit) {
        let limitC: number = angle - this.m_upperAngle;
        angularError = b2Math.b2Max(0, limitC);
        limitC = b2Math.b2Clamp(limitC - b2Settings.b2_angularSlop, 0, b2Settings.b2_maxAngularCorrection);
        limitImpulse = -this.m_motorMass * limitC;
        const oldLimitImpulse: number = this.m_limitPositionImpulse;
        this.m_limitPositionImpulse = b2Math.b2Min(this.m_limitPositionImpulse + limitImpulse, 0);
        limitImpulse = this.m_limitPositionImpulse - oldLimitImpulse;
      }
      b1.m_sweep.a -= b1.m_invI * limitImpulse;
      b2.m_sweep.a += b2.m_invI * limitImpulse;
      b1.SynchronizeTransform();
      b2.SynchronizeTransform();
    }
    return positionError <= b2Settings.b2_linearSlop && angularError <= b2Settings.b2_angularSlop;
  }
}

registerJointType(b2Joint.e_revoluteJoint, (def) => new b2RevoluteJoint(def as b2RevoluteJointDef));
