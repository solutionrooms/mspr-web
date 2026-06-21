// Port of Box2D/Dynamics/Joints/b2PrismaticJoint.as (Box2DFlash 2.0.2), line-by-line.
// 2.0.x FORCE-based prismatic (translation along an axis + perpendicular/angular lock,
// with optional motor + translation limit), driven via b2Jacobian. Op order preserved.
import { b2Joint } from "./b2Joint";
import { b2PrismaticJointDef } from "./b2PrismaticJointDef";
import { b2Jacobian } from "./b2Jacobian";
import { b2Math } from "../../Common/Math/b2Math";
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import { b2Settings } from "../../Common/b2Settings";
import type { b2Mat22 } from "../../Common/Math/b2Mat22";
import type { b2Body } from "../b2Body";
import type { b2TimeStep } from "../b2TimeStep";
import { registerJointType } from "./_jointFactory";

export class b2PrismaticJoint extends b2Joint {
  public m_localAnchor1: b2Vec2;
  public m_localAnchor2: b2Vec2;
  public m_localXAxis1: b2Vec2;
  public m_localYAxis1: b2Vec2;
  public m_refAngle!: number;
  public m_linearJacobian: b2Jacobian;
  public m_linearMass!: number;
  public m_force!: number;
  public m_angularMass!: number;
  public m_torque!: number;
  public m_motorJacobian: b2Jacobian;
  public m_motorMass!: number;
  public m_motorForce!: number;
  public m_limitForce!: number;
  public m_limitPositionImpulse!: number;
  public m_lowerTranslation!: number;
  public m_upperTranslation!: number;
  public m_maxMotorForce!: number;
  public m_motorSpeed!: number;
  public m_enableLimit!: boolean;
  public m_enableMotor!: boolean;
  public m_limitState!: number;

  // b2PrismaticJoint.as:57-91
  constructor(def: b2PrismaticJointDef) {
    super(def);
    this.m_localAnchor1 = new b2Vec2();
    this.m_localAnchor2 = new b2Vec2();
    this.m_localXAxis1 = new b2Vec2();
    this.m_localYAxis1 = new b2Vec2();
    this.m_linearJacobian = new b2Jacobian();
    this.m_motorJacobian = new b2Jacobian();
    this.m_localAnchor1.SetV(def.localAnchor1);
    this.m_localAnchor2.SetV(def.localAnchor2);
    this.m_localXAxis1.SetV(def.localAxis1);
    this.m_localYAxis1.x = -this.m_localXAxis1.y;
    this.m_localYAxis1.y = this.m_localXAxis1.x;
    this.m_refAngle = def.referenceAngle;
    this.m_linearJacobian.SetZero();
    this.m_linearMass = 0;
    this.m_force = 0;
    this.m_angularMass = 0;
    this.m_torque = 0;
    this.m_motorJacobian.SetZero();
    this.m_motorMass = 0;
    this.m_motorForce = 0;
    this.m_limitForce = 0;
    this.m_limitPositionImpulse = 0;
    this.m_lowerTranslation = def.lowerTranslation;
    this.m_upperTranslation = def.upperTranslation;
    this.m_maxMotorForce = def.maxMotorForce;
    this.m_motorSpeed = def.motorSpeed;
    this.m_enableLimit = def.enableLimit;
    this.m_enableMotor = def.enableMotor;
  }

  // b2PrismaticJoint.as:93-116
  public override GetAnchor1(): b2Vec2 {
    return this.m_body1.GetWorldPoint(this.m_localAnchor1);
  }
  public override GetAnchor2(): b2Vec2 {
    return this.m_body2.GetWorldPoint(this.m_localAnchor2);
  }
  public override GetReactionForce(): b2Vec2 {
    const tMat: b2Mat22 = this.m_body1.m_xf.R;
    const limitX: number = this.m_limitForce * (tMat.col1.x * this.m_localXAxis1.x + tMat.col2.x * this.m_localXAxis1.y);
    const limitY: number = this.m_limitForce * (tMat.col1.y * this.m_localXAxis1.x + tMat.col2.y * this.m_localXAxis1.y);
    const perpX: number = this.m_force * (tMat.col1.x * this.m_localYAxis1.x + tMat.col2.x * this.m_localYAxis1.y);
    const perpY: number = this.m_force * (tMat.col1.y * this.m_localYAxis1.x + tMat.col2.y * this.m_localYAxis1.y);
    return new b2Vec2(this.m_limitForce * limitX + this.m_force * perpX, this.m_limitForce * limitY + this.m_force * perpY);
  }
  public override GetReactionTorque(): number {
    return this.m_torque;
  }

  // b2PrismaticJoint.as:118-129
  public GetJointTranslation(): number {
    const b1: b2Body = this.m_body1;
    const b2: b2Body = this.m_body2;
    const p1: b2Vec2 = b1.GetWorldPoint(this.m_localAnchor1);
    const p2: b2Vec2 = b2.GetWorldPoint(this.m_localAnchor2);
    const dX: number = p2.x - p1.x;
    const dY: number = p2.y - p1.y;
    const axis: b2Vec2 = b1.GetWorldVector(this.m_localXAxis1);
    return axis.x * dX + axis.y * dY;
  }

  // b2PrismaticJoint.as:131-160
  public GetJointSpeed(): number {
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
    const dX: number = p2X - p1X;
    const dY: number = p2Y - p1Y;
    const axis: b2Vec2 = b1.GetWorldVector(this.m_localXAxis1);
    const v1: b2Vec2 = b1.m_linearVelocity;
    const v2: b2Vec2 = b2.m_linearVelocity;
    const w1: number = b1.m_angularVelocity;
    const w2: number = b2.m_angularVelocity;
    return (
      dX * (-w1 * axis.y) +
      dY * (w1 * axis.x) +
      (axis.x * (v2.x + -w2 * r2Y - v1.x - -w1 * r1Y) + axis.y * (v2.y + w2 * r2X - v1.y - w1 * r1X))
    );
  }

  // b2PrismaticJoint.as:162-216
  public IsLimitEnabled(): boolean {
    return this.m_enableLimit;
  }
  public EnableLimit(flag: boolean): void {
    this.m_enableLimit = flag;
  }
  public GetLowerLimit(): number {
    return this.m_lowerTranslation;
  }
  public GetUpperLimit(): number {
    return this.m_upperTranslation;
  }
  public SetLimits(lower: number, upper: number): void {
    this.m_lowerTranslation = lower;
    this.m_upperTranslation = upper;
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
  public SetMaxMotorForce(force: number): void {
    this.m_maxMotorForce = force;
  }
  public GetMotorForce(): number {
    return this.m_motorForce;
  }

  // b2PrismaticJoint.as:218-345
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
    tMat = b1.m_xf.R;
    const ay1X: number = tMat.col1.x * this.m_localYAxis1.x + tMat.col2.x * this.m_localYAxis1.y;
    const ay1Y: number = tMat.col1.y * this.m_localYAxis1.x + tMat.col2.y * this.m_localYAxis1.y;
    const e1X: number = b2.m_sweep.c.x + r2X - b1.m_sweep.c.x;
    const e1Y: number = b2.m_sweep.c.y + r2Y - b1.m_sweep.c.y;
    this.m_linearJacobian.linear1.x = -ay1X;
    this.m_linearJacobian.linear1.y = -ay1Y;
    this.m_linearJacobian.linear2.x = ay1X;
    this.m_linearJacobian.linear2.y = ay1Y;
    this.m_linearJacobian.angular1 = -(e1X * ay1Y - e1Y * ay1X);
    this.m_linearJacobian.angular2 = r2X * ay1Y - r2Y * ay1X;
    this.m_linearMass =
      invMass1 +
      invI1 * this.m_linearJacobian.angular1 * this.m_linearJacobian.angular1 +
      invMass2 +
      invI2 * this.m_linearJacobian.angular2 * this.m_linearJacobian.angular2;
    this.m_linearMass = 1 / this.m_linearMass;
    this.m_angularMass = invI1 + invI2;
    if (this.m_angularMass > Number.MIN_VALUE) {
      this.m_angularMass = 1 / this.m_angularMass;
    }
    if (this.m_enableLimit || this.m_enableMotor) {
      tMat = b1.m_xf.R;
      const ax1X: number = tMat.col1.x * this.m_localXAxis1.x + tMat.col2.x * this.m_localXAxis1.y;
      const ax1Y: number = tMat.col1.y * this.m_localXAxis1.x + tMat.col2.y * this.m_localXAxis1.y;
      this.m_motorJacobian.linear1.x = -ax1X;
      this.m_motorJacobian.linear1.y = -ax1Y;
      this.m_motorJacobian.linear2.x = ax1X;
      this.m_motorJacobian.linear2.y = ax1Y;
      this.m_motorJacobian.angular1 = -(e1X * ax1Y - e1Y * ax1X);
      this.m_motorJacobian.angular2 = r2X * ax1Y - r2Y * ax1X;
      this.m_motorMass =
        invMass1 +
        invI1 * this.m_motorJacobian.angular1 * this.m_motorJacobian.angular1 +
        invMass2 +
        invI2 * this.m_motorJacobian.angular2 * this.m_motorJacobian.angular2;
      this.m_motorMass = 1 / this.m_motorMass;
      if (this.m_enableLimit) {
        const dX: number = e1X - r1X;
        const dY: number = e1Y - r1Y;
        const jointTransition: number = ax1X * dX + ax1Y * dY;
        if (b2Math.b2Abs(this.m_upperTranslation - this.m_lowerTranslation) < 2 * b2Settings.b2_linearSlop) {
          this.m_limitState = b2Joint.e_equalLimits;
        } else if (jointTransition <= this.m_lowerTranslation) {
          if (this.m_limitState !== b2Joint.e_atLowerLimit) {
            this.m_limitForce = 0;
          }
          this.m_limitState = b2Joint.e_atLowerLimit;
        } else if (jointTransition >= this.m_upperTranslation) {
          if (this.m_limitState !== b2Joint.e_atUpperLimit) {
            this.m_limitForce = 0;
          }
          this.m_limitState = b2Joint.e_atUpperLimit;
        } else {
          this.m_limitState = b2Joint.e_inactiveLimit;
          this.m_limitForce = 0;
        }
      }
    }
    if (this.m_enableMotor === false) {
      this.m_motorForce = 0;
    }
    if (this.m_enableLimit === false) {
      this.m_limitForce = 0;
    }
    if (step.warmStarting) {
      const P1X: number =
        step.dt * (this.m_force * this.m_linearJacobian.linear1.x + (this.m_motorForce + this.m_limitForce) * this.m_motorJacobian.linear1.x);
      const P1Y: number =
        step.dt * (this.m_force * this.m_linearJacobian.linear1.y + (this.m_motorForce + this.m_limitForce) * this.m_motorJacobian.linear1.y);
      const P2X: number =
        step.dt * (this.m_force * this.m_linearJacobian.linear2.x + (this.m_motorForce + this.m_limitForce) * this.m_motorJacobian.linear2.x);
      const P2Y: number =
        step.dt * (this.m_force * this.m_linearJacobian.linear2.y + (this.m_motorForce + this.m_limitForce) * this.m_motorJacobian.linear2.y);
      const L1: number =
        step.dt * (this.m_force * this.m_linearJacobian.angular1 - this.m_torque + (this.m_motorForce + this.m_limitForce) * this.m_motorJacobian.angular1);
      const L2: number =
        step.dt * (this.m_force * this.m_linearJacobian.angular2 + this.m_torque + (this.m_motorForce + this.m_limitForce) * this.m_motorJacobian.angular2);
      b1.m_linearVelocity.x += invMass1 * P1X;
      b1.m_linearVelocity.y += invMass1 * P1Y;
      b1.m_angularVelocity += invI1 * L1;
      b2.m_linearVelocity.x += invMass2 * P2X;
      b2.m_linearVelocity.y += invMass2 * P2Y;
      b2.m_angularVelocity += invI2 * L2;
    } else {
      this.m_force = 0;
      this.m_torque = 0;
      this.m_limitForce = 0;
      this.m_motorForce = 0;
    }
    this.m_limitPositionImpulse = 0;
  }

  // b2PrismaticJoint.as:347-421
  public override SolveVelocityConstraints(step: b2TimeStep): void {
    const b1: b2Body = this.m_body1;
    const b2: b2Body = this.m_body2;
    const invMass1: number = b1.m_invMass;
    const invMass2: number = b2.m_invMass;
    const invI1: number = b1.m_invI;
    const invI2: number = b2.m_invI;
    const linearCdot: number = this.m_linearJacobian.Compute(
      b1.m_linearVelocity,
      b1.m_angularVelocity,
      b2.m_linearVelocity,
      b2.m_angularVelocity,
    );
    const linearForce: number = -step.inv_dt * this.m_linearMass * linearCdot;
    this.m_force += linearForce;
    let P: number = step.dt * linearForce;
    b1.m_linearVelocity.x += invMass1 * P * this.m_linearJacobian.linear1.x;
    b1.m_linearVelocity.y += invMass1 * P * this.m_linearJacobian.linear1.y;
    b1.m_angularVelocity += invI1 * P * this.m_linearJacobian.angular1;
    b2.m_linearVelocity.x += invMass2 * P * this.m_linearJacobian.linear2.x;
    b2.m_linearVelocity.y += invMass2 * P * this.m_linearJacobian.linear2.y;
    b2.m_angularVelocity += invI2 * P * this.m_linearJacobian.angular2;
    const angularCdot: number = b2.m_angularVelocity - b1.m_angularVelocity;
    const angularForce: number = -step.inv_dt * this.m_angularMass * angularCdot;
    this.m_torque += angularForce;
    const L: number = step.dt * angularForce;
    b1.m_angularVelocity -= invI1 * L;
    b2.m_angularVelocity += invI2 * L;
    if (this.m_enableMotor && this.m_limitState !== b2Joint.e_equalLimits) {
      const motorCdot: number =
        this.m_motorJacobian.Compute(b1.m_linearVelocity, b1.m_angularVelocity, b2.m_linearVelocity, b2.m_angularVelocity) -
        this.m_motorSpeed;
      let motorForce: number = -step.inv_dt * this.m_motorMass * motorCdot;
      const oldMotorForce: number = this.m_motorForce;
      this.m_motorForce = b2Math.b2Clamp(this.m_motorForce + motorForce, -this.m_maxMotorForce, this.m_maxMotorForce);
      motorForce = this.m_motorForce - oldMotorForce;
      P = step.dt * motorForce;
      b1.m_linearVelocity.x += invMass1 * P * this.m_motorJacobian.linear1.x;
      b1.m_linearVelocity.y += invMass1 * P * this.m_motorJacobian.linear1.y;
      b1.m_angularVelocity += invI1 * P * this.m_motorJacobian.angular1;
      b2.m_linearVelocity.x += invMass2 * P * this.m_motorJacobian.linear2.x;
      b2.m_linearVelocity.y += invMass2 * P * this.m_motorJacobian.linear2.y;
      b2.m_angularVelocity += invI2 * P * this.m_motorJacobian.angular2;
    }
    if (this.m_enableLimit && this.m_limitState !== b2Joint.e_inactiveLimit) {
      const limitCdot: number = this.m_motorJacobian.Compute(
        b1.m_linearVelocity,
        b1.m_angularVelocity,
        b2.m_linearVelocity,
        b2.m_angularVelocity,
      );
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
      P = step.dt * limitForce;
      b1.m_linearVelocity.x += invMass1 * P * this.m_motorJacobian.linear1.x;
      b1.m_linearVelocity.y += invMass1 * P * this.m_motorJacobian.linear1.y;
      b1.m_angularVelocity += invI1 * P * this.m_motorJacobian.angular1;
      b2.m_linearVelocity.x += invMass2 * P * this.m_motorJacobian.linear2.x;
      b2.m_linearVelocity.y += invMass2 * P * this.m_motorJacobian.linear2.y;
      b2.m_angularVelocity += invI2 * P * this.m_motorJacobian.angular2;
    }
  }

  // b2PrismaticJoint.as:423-539
  public override SolvePositionConstraints(): boolean {
    const b1: b2Body = this.m_body1;
    const b2: b2Body = this.m_body2;
    const invMass1: number = b1.m_invMass;
    const invMass2: number = b2.m_invMass;
    const invI1: number = b1.m_invI;
    const invI2: number = b2.m_invI;
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
    let p1X: number = b1.m_sweep.c.x + r1X;
    let p1Y: number = b1.m_sweep.c.y + r1Y;
    let p2X: number = b2.m_sweep.c.x + r2X;
    let p2Y: number = b2.m_sweep.c.y + r2Y;
    let dX: number = p2X - p1X;
    let dY: number = p2Y - p1Y;
    tMat = b1.m_xf.R;
    let ay1X: number = tMat.col1.x * this.m_localYAxis1.x + tMat.col2.x * this.m_localYAxis1.y;
    let ay1Y: number = tMat.col1.y * this.m_localYAxis1.x + tMat.col2.y * this.m_localYAxis1.y;
    let linearC: number = ay1X * dX + ay1Y * dY;
    linearC = b2Math.b2Clamp(linearC, -b2Settings.b2_maxLinearCorrection, b2Settings.b2_maxLinearCorrection);
    const linearImpulse: number = -this.m_linearMass * linearC;
    b1.m_sweep.c.x += invMass1 * linearImpulse * this.m_linearJacobian.linear1.x;
    b1.m_sweep.c.y += invMass1 * linearImpulse * this.m_linearJacobian.linear1.y;
    b1.m_sweep.a += invI1 * linearImpulse * this.m_linearJacobian.angular1;
    b2.m_sweep.c.x += invMass2 * linearImpulse * this.m_linearJacobian.linear2.x;
    b2.m_sweep.c.y += invMass2 * linearImpulse * this.m_linearJacobian.linear2.y;
    b2.m_sweep.a += invI2 * linearImpulse * this.m_linearJacobian.angular2;
    let positionError: number = b2Math.b2Abs(linearC);
    let angularC: number = b2.m_sweep.a - b1.m_sweep.a - this.m_refAngle;
    angularC = b2Math.b2Clamp(angularC, -b2Settings.b2_maxAngularCorrection, b2Settings.b2_maxAngularCorrection);
    const angularImpulse: number = -this.m_angularMass * angularC;
    b1.m_sweep.a -= b1.m_invI * angularImpulse;
    b2.m_sweep.a += b2.m_invI * angularImpulse;
    b1.SynchronizeTransform();
    b2.SynchronizeTransform();
    const angularError: number = b2Math.b2Abs(angularC);
    if (this.m_enableLimit && this.m_limitState !== b2Joint.e_inactiveLimit) {
      tMat = b1.m_xf.R;
      r1X = this.m_localAnchor1.x - b1.m_sweep.localCenter.x;
      r1Y = this.m_localAnchor1.y - b1.m_sweep.localCenter.y;
      tX = tMat.col1.x * r1X + tMat.col2.x * r1Y;
      r1Y = tMat.col1.y * r1X + tMat.col2.y * r1Y;
      r1X = tX;
      tMat = b2.m_xf.R;
      r2X = this.m_localAnchor2.x - b2.m_sweep.localCenter.x;
      r2Y = this.m_localAnchor2.y - b2.m_sweep.localCenter.y;
      tX = tMat.col1.x * r2X + tMat.col2.x * r2Y;
      r2Y = tMat.col1.y * r2X + tMat.col2.y * r2Y;
      r2X = tX;
      p1X = b1.m_sweep.c.x + r1X;
      p1Y = b1.m_sweep.c.y + r1Y;
      p2X = b2.m_sweep.c.x + r2X;
      p2Y = b2.m_sweep.c.y + r2Y;
      dX = p2X - p1X;
      dY = p2Y - p1Y;
      tMat = b1.m_xf.R;
      const ax1X: number = tMat.col1.x * this.m_localXAxis1.x + tMat.col2.x * this.m_localXAxis1.y;
      const ax1Y: number = tMat.col1.y * this.m_localXAxis1.x + tMat.col2.y * this.m_localXAxis1.y;
      const translation: number = ax1X * dX + ax1Y * dY;
      let limitImpulse: number = 0;
      if (this.m_limitState === b2Joint.e_equalLimits) {
        const limitC: number = b2Math.b2Clamp(translation, -b2Settings.b2_maxLinearCorrection, b2Settings.b2_maxLinearCorrection);
        limitImpulse = -this.m_motorMass * limitC;
        positionError = b2Math.b2Max(positionError, b2Math.b2Abs(angularC));
      } else if (this.m_limitState === b2Joint.e_atLowerLimit) {
        let limitC: number = translation - this.m_lowerTranslation;
        positionError = b2Math.b2Max(positionError, -limitC);
        limitC = b2Math.b2Clamp(limitC + b2Settings.b2_linearSlop, -b2Settings.b2_maxLinearCorrection, 0);
        limitImpulse = -this.m_motorMass * limitC;
        const oldLimitImpulse: number = this.m_limitPositionImpulse;
        this.m_limitPositionImpulse = b2Math.b2Max(this.m_limitPositionImpulse + limitImpulse, 0);
        limitImpulse = this.m_limitPositionImpulse - oldLimitImpulse;
      } else if (this.m_limitState === b2Joint.e_atUpperLimit) {
        let limitC: number = translation - this.m_upperTranslation;
        positionError = b2Math.b2Max(positionError, limitC);
        limitC = b2Math.b2Clamp(limitC - b2Settings.b2_linearSlop, 0, b2Settings.b2_maxLinearCorrection);
        limitImpulse = -this.m_motorMass * limitC;
        const oldLimitImpulse: number = this.m_limitPositionImpulse;
        this.m_limitPositionImpulse = b2Math.b2Min(this.m_limitPositionImpulse + limitImpulse, 0);
        limitImpulse = this.m_limitPositionImpulse - oldLimitImpulse;
      }
      b1.m_sweep.c.x += invMass1 * limitImpulse * this.m_motorJacobian.linear1.x;
      b1.m_sweep.c.y += invMass1 * limitImpulse * this.m_motorJacobian.linear1.y;
      b1.m_sweep.a += invI1 * limitImpulse * this.m_motorJacobian.angular1;
      b2.m_sweep.c.x += invMass2 * limitImpulse * this.m_motorJacobian.linear2.x;
      b2.m_sweep.c.y += invMass2 * limitImpulse * this.m_motorJacobian.linear2.y;
      b2.m_sweep.a += invI2 * limitImpulse * this.m_motorJacobian.angular2;
      b1.SynchronizeTransform();
      b2.SynchronizeTransform();
    }
    return positionError <= b2Settings.b2_linearSlop && angularError <= b2Settings.b2_angularSlop;
  }
}

registerJointType(b2Joint.e_prismaticJoint, (def) => new b2PrismaticJoint(def as b2PrismaticJointDef));
