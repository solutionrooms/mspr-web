// Port of Box2D/Dynamics/Joints/b2GearJoint.as (Box2DFlash 2.0.2), line-by-line.
// Couples two revolute/prismatic joints with a gear ratio via a single jacobian
// constraint. Op order preserved exactly. (Unused by FZ3, ported for completeness.)
import { b2Joint } from "./b2Joint";
import type { b2GearJointDef } from "./b2GearJointDef";
import { b2RevoluteJoint } from "./b2RevoluteJoint";
import { b2PrismaticJoint } from "./b2PrismaticJoint";
import { b2Jacobian } from "./b2Jacobian";
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import { b2Settings } from "../../Common/b2Settings";
import type { b2Mat22 } from "../../Common/Math/b2Mat22";
import type { b2Body } from "../b2Body";
import type { b2TimeStep } from "../b2TimeStep";
import { registerJointType } from "./_jointFactory";

export class b2GearJoint extends b2Joint {
  public m_ground1!: b2Body;
  public m_ground2!: b2Body;
  public m_revolute1: b2RevoluteJoint | null;
  public m_prismatic1: b2PrismaticJoint | null;
  public m_revolute2: b2RevoluteJoint | null;
  public m_prismatic2: b2PrismaticJoint | null;
  public m_groundAnchor1: b2Vec2;
  public m_groundAnchor2: b2Vec2;
  public m_localAnchor1: b2Vec2;
  public m_localAnchor2: b2Vec2;
  public m_J: b2Jacobian;
  public m_constant!: number;
  public m_ratio!: number;
  public m_mass!: number;
  public m_force!: number;

  // b2GearJoint.as:42-93
  constructor(def: b2GearJointDef) {
    super(def);
    this.m_groundAnchor1 = new b2Vec2();
    this.m_groundAnchor2 = new b2Vec2();
    this.m_localAnchor1 = new b2Vec2();
    this.m_localAnchor2 = new b2Vec2();
    this.m_J = new b2Jacobian();
    const type1: number = def.joint1!.m_type;
    const type2: number = def.joint2!.m_type;
    this.m_revolute1 = null;
    this.m_prismatic1 = null;
    this.m_revolute2 = null;
    this.m_prismatic2 = null;
    this.m_ground1 = def.joint1!.m_body1;
    this.m_body1 = def.joint1!.m_body2;
    let coordinate1: number;
    if (type1 === b2Joint.e_revoluteJoint) {
      this.m_revolute1 = def.joint1 as b2RevoluteJoint;
      this.m_groundAnchor1.SetV(this.m_revolute1.m_localAnchor1);
      this.m_localAnchor1.SetV(this.m_revolute1.m_localAnchor2);
      coordinate1 = this.m_revolute1.GetJointAngle();
    } else {
      this.m_prismatic1 = def.joint1 as b2PrismaticJoint;
      this.m_groundAnchor1.SetV(this.m_prismatic1.m_localAnchor1);
      this.m_localAnchor1.SetV(this.m_prismatic1.m_localAnchor2);
      coordinate1 = this.m_prismatic1.GetJointTranslation();
    }
    this.m_ground2 = def.joint2!.m_body1;
    this.m_body2 = def.joint2!.m_body2;
    let coordinate2: number;
    if (type2 === b2Joint.e_revoluteJoint) {
      this.m_revolute2 = def.joint2 as b2RevoluteJoint;
      this.m_groundAnchor2.SetV(this.m_revolute2.m_localAnchor1);
      this.m_localAnchor2.SetV(this.m_revolute2.m_localAnchor2);
      coordinate2 = this.m_revolute2.GetJointAngle();
    } else {
      this.m_prismatic2 = def.joint2 as b2PrismaticJoint;
      this.m_groundAnchor2.SetV(this.m_prismatic2.m_localAnchor1);
      this.m_localAnchor2.SetV(this.m_prismatic2.m_localAnchor2);
      coordinate2 = this.m_prismatic2.GetJointTranslation();
    }
    this.m_ratio = def.ratio;
    this.m_constant = coordinate1 + this.m_ratio * coordinate2;
    this.m_force = 0;
  }

  // b2GearJoint.as:95-124
  public override GetAnchor1(): b2Vec2 {
    return this.m_body1.GetWorldPoint(this.m_localAnchor1);
  }
  public override GetAnchor2(): b2Vec2 {
    return this.m_body2.GetWorldPoint(this.m_localAnchor2);
  }
  public override GetReactionForce(): b2Vec2 {
    return new b2Vec2(this.m_force * this.m_J.linear2.x, this.m_force * this.m_J.linear2.y);
  }
  public override GetReactionTorque(): number {
    const tMat: b2Mat22 = this.m_body2.m_xf.R;
    let rX: number = this.m_localAnchor1.x - this.m_body2.m_sweep.localCenter.x;
    let rY: number = this.m_localAnchor1.y - this.m_body2.m_sweep.localCenter.y;
    const tX: number = tMat.col1.x * rX + tMat.col2.x * rY;
    rY = tMat.col1.y * rX + tMat.col2.y * rY;
    rX = tX;
    return (
      this.m_force * this.m_J.angular2 -
      (rX * (this.m_force * this.m_J.linear2.y) - rY * (this.m_force * this.m_J.linear2.x))
    );
  }
  public GetRatio(): number {
    return this.m_ratio;
  }

  // b2GearJoint.as:126-202
  public override InitVelocityConstraints(step: b2TimeStep): void {
    const g1: b2Body = this.m_ground1;
    const g2: b2Body = this.m_ground2;
    const b1: b2Body = this.m_body1;
    const b2: b2Body = this.m_body2;
    let K: number = 0;
    this.m_J.SetZero();
    if (this.m_revolute1) {
      this.m_J.angular1 = -1;
      K += b1.m_invI;
    } else {
      let tMat: b2Mat22 = g1.m_xf.R;
      let ug: b2Vec2 = this.m_prismatic1!.m_localXAxis1;
      const ugX: number = tMat.col1.x * ug.x + tMat.col2.x * ug.y;
      const ugY: number = tMat.col1.y * ug.x + tMat.col2.y * ug.y;
      tMat = b1.m_xf.R;
      let rX: number = this.m_localAnchor1.x - b1.m_sweep.localCenter.x;
      let rY: number = this.m_localAnchor1.y - b1.m_sweep.localCenter.y;
      const tX: number = tMat.col1.x * rX + tMat.col2.x * rY;
      rY = tMat.col1.y * rX + tMat.col2.y * rY;
      rX = tX;
      const crug: number = rX * ugY - rY * ugX;
      this.m_J.linear1.Set(-ugX, -ugY);
      this.m_J.angular1 = -crug;
      K += b1.m_invMass + b1.m_invI * crug * crug;
    }
    if (this.m_revolute2) {
      this.m_J.angular2 = -this.m_ratio;
      K += this.m_ratio * this.m_ratio * b2.m_invI;
    } else {
      let tMat: b2Mat22 = g2.m_xf.R;
      let ug: b2Vec2 = this.m_prismatic2!.m_localXAxis1;
      const ugX: number = tMat.col1.x * ug.x + tMat.col2.x * ug.y;
      const ugY: number = tMat.col1.y * ug.x + tMat.col2.y * ug.y;
      tMat = b2.m_xf.R;
      let rX: number = this.m_localAnchor2.x - b2.m_sweep.localCenter.x;
      let rY: number = this.m_localAnchor2.y - b2.m_sweep.localCenter.y;
      const tX: number = tMat.col1.x * rX + tMat.col2.x * rY;
      rY = tMat.col1.y * rX + tMat.col2.y * rY;
      rX = tX;
      const crug: number = rX * ugY - rY * ugX;
      this.m_J.linear2.Set(-this.m_ratio * ugX, -this.m_ratio * ugY);
      this.m_J.angular2 = -this.m_ratio * crug;
      K += this.m_ratio * this.m_ratio * (b2.m_invMass + b2.m_invI * crug * crug);
    }
    this.m_mass = 1 / K;
    if (step.warmStarting) {
      const P: number = step.dt * this.m_force;
      b1.m_linearVelocity.x += b1.m_invMass * P * this.m_J.linear1.x;
      b1.m_linearVelocity.y += b1.m_invMass * P * this.m_J.linear1.y;
      b1.m_angularVelocity += b1.m_invI * P * this.m_J.angular1;
      b2.m_linearVelocity.x += b2.m_invMass * P * this.m_J.linear2.x;
      b2.m_linearVelocity.y += b2.m_invMass * P * this.m_J.linear2.y;
      b2.m_angularVelocity += b2.m_invI * P * this.m_J.angular2;
    } else {
      this.m_force = 0;
    }
  }

  // b2GearJoint.as:204-218
  public override SolveVelocityConstraints(step: b2TimeStep): void {
    const b1: b2Body = this.m_body1;
    const b2: b2Body = this.m_body2;
    const Cdot: number = this.m_J.Compute(b1.m_linearVelocity, b1.m_angularVelocity, b2.m_linearVelocity, b2.m_angularVelocity);
    const force: number = -step.inv_dt * this.m_mass * Cdot;
    this.m_force += force;
    const P: number = step.dt * force;
    b1.m_linearVelocity.x += b1.m_invMass * P * this.m_J.linear1.x;
    b1.m_linearVelocity.y += b1.m_invMass * P * this.m_J.linear1.y;
    b1.m_angularVelocity += b1.m_invI * P * this.m_J.angular1;
    b2.m_linearVelocity.x += b2.m_invMass * P * this.m_J.linear2.x;
    b2.m_linearVelocity.y += b2.m_invMass * P * this.m_J.linear2.y;
    b2.m_angularVelocity += b2.m_invI * P * this.m_J.angular2;
  }

  // b2GearJoint.as:220-254
  public override SolvePositionConstraints(): boolean {
    const linearError: number = 0;
    const b1: b2Body = this.m_body1;
    const b2: b2Body = this.m_body2;
    let coordinate1: number;
    let coordinate2: number;
    if (this.m_revolute1) {
      coordinate1 = this.m_revolute1.GetJointAngle();
    } else {
      coordinate1 = this.m_prismatic1!.GetJointTranslation();
    }
    if (this.m_revolute2) {
      coordinate2 = this.m_revolute2.GetJointAngle();
    } else {
      coordinate2 = this.m_prismatic2!.GetJointTranslation();
    }
    const C: number = this.m_constant - (coordinate1 + this.m_ratio * coordinate2);
    const impulse: number = -this.m_mass * C;
    b1.m_sweep.c.x += b1.m_invMass * impulse * this.m_J.linear1.x;
    b1.m_sweep.c.y += b1.m_invMass * impulse * this.m_J.linear1.y;
    b1.m_sweep.a += b1.m_invI * impulse * this.m_J.angular1;
    b2.m_sweep.c.x += b2.m_invMass * impulse * this.m_J.linear2.x;
    b2.m_sweep.c.y += b2.m_invMass * impulse * this.m_J.linear2.y;
    b2.m_sweep.a += b2.m_invI * impulse * this.m_J.angular2;
    b1.SynchronizeTransform();
    b2.SynchronizeTransform();
    return linearError < b2Settings.b2_linearSlop;
  }
}

registerJointType(b2Joint.e_gearJoint, (def) => new b2GearJoint(def as b2GearJointDef));
