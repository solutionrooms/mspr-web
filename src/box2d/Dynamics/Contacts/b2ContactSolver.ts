// Port of Box2D/Dynamics/Contacts/b2ContactSolver.as (Box2DFlash 2.0.2), line-by-line.
// The 2.0.x sequential-impulse contact solver with INLINE Baumgarte position correction
// (no separate position-iteration loop — that's 2.1+). Op order preserved exactly.
//
// Key 2.0.x faithfulness points (CLAUDE.md): restitution is killed below
// b2_velocityThreshold; velocityBias uses the hard-coded -60 (= -1/dt at 60Hz) penetration
// term; equalizedMass for the position solve; warm-start scales prior impulses by dtRatio.
import { b2TimeStep } from "../b2TimeStep";
import { b2Settings } from "../../Common/b2Settings";
import { b2Math } from "../../Common/Math/b2Math";
import type { b2Mat22 } from "../../Common/Math/b2Mat22";
import type { b2Vec2 } from "../../Common/Math/b2Vec2";
import type { b2Body } from "../b2Body";
import type { b2Manifold } from "../../Collision/b2Manifold";
import type { b2ManifoldPoint } from "../../Collision/b2ManifoldPoint";
import type { b2Contact } from "./b2Contact";
import { b2ContactConstraint } from "./b2ContactConstraint";
import type { b2ContactConstraintPoint } from "./b2ContactConstraintPoint";

export class b2ContactSolver {
  public m_step: b2TimeStep;
  public m_allocator: unknown;
  public m_constraints: b2ContactConstraint[];
  public m_constraintCount: number;

  // b2ContactSolver.as:19-177
  constructor(step: b2TimeStep, contacts: b2Contact[], contactCount: number, allocator: unknown) {
    this.m_step = new b2TimeStep();
    this.m_constraints = new Array();
    this.m_step.dt = step.dt;
    this.m_step.inv_dt = step.inv_dt;
    this.m_step.maxIterations = step.maxIterations;
    this.m_allocator = allocator;
    this.m_constraintCount = 0;
    let i = 0;
    while (i < contactCount) {
      const contact: b2Contact = contacts[i];
      this.m_constraintCount += contact.m_manifoldCount;
      i++;
    }
    i = 0;
    while (i < this.m_constraintCount) {
      this.m_constraints[i] = new b2ContactConstraint();
      i++;
    }
    let count: number = 0;
    i = 0;
    while (i < contactCount) {
      const contact: b2Contact = contacts[i];
      const b1: b2Body = contact.m_shape1!.m_body!;
      const b2: b2Body = contact.m_shape2!.m_body!;
      const manifoldCount: number = contact.m_manifoldCount;
      const manifolds: b2Manifold[] = contact.GetManifolds()!;
      const friction: number = contact.m_friction;
      const restitution: number = contact.m_restitution;
      const v1X: number = b1.m_linearVelocity.x;
      const v1Y: number = b1.m_linearVelocity.y;
      const v2X: number = b2.m_linearVelocity.x;
      const v2Y: number = b2.m_linearVelocity.y;
      const w1: number = b1.m_angularVelocity;
      const w2: number = b2.m_angularVelocity;
      let j = 0;
      while (j < manifoldCount) {
        const manifold: b2Manifold = manifolds[j];
        const normalX: number = manifold.normal.x;
        const normalY: number = manifold.normal.y;
        const cc: b2ContactConstraint = this.m_constraints[count];
        cc.body1 = b1;
        cc.body2 = b2;
        cc.manifold = manifold;
        cc.normal.x = normalX;
        cc.normal.y = normalY;
        cc.pointCount = manifold.pointCount;
        cc.friction = friction;
        cc.restitution = restitution;
        let k = 0;
        while (k < cc.pointCount) {
          const cp: b2ManifoldPoint = manifold.points[k];
          const ccp: b2ContactConstraintPoint = cc.points[k];
          ccp.normalImpulse = cp.normalImpulse;
          ccp.tangentImpulse = cp.tangentImpulse;
          ccp.separation = cp.separation;
          ccp.positionImpulse = 0;
          ccp.localAnchor1.SetV(cp.localPoint1);
          ccp.localAnchor2.SetV(cp.localPoint2);
          let tMat: b2Mat22 = b1.m_xf.R;
          let r1X: number = cp.localPoint1.x - b1.m_sweep.localCenter.x;
          let r1Y: number = cp.localPoint1.y - b1.m_sweep.localCenter.y;
          let tX: number = tMat.col1.x * r1X + tMat.col2.x * r1Y;
          r1Y = tMat.col1.y * r1X + tMat.col2.y * r1Y;
          r1X = tX;
          ccp.r1.Set(r1X, r1Y);
          tMat = b2.m_xf.R;
          let r2X: number = cp.localPoint2.x - b2.m_sweep.localCenter.x;
          let r2Y: number = cp.localPoint2.y - b2.m_sweep.localCenter.y;
          tX = tMat.col1.x * r2X + tMat.col2.x * r2Y;
          r2Y = tMat.col1.y * r2X + tMat.col2.y * r2Y;
          r2X = tX;
          ccp.r2.Set(r2X, r2Y);
          const r1Sqr: number = r1X * r1X + r1Y * r1Y;
          const r2Sqr: number = r2X * r2X + r2Y * r2Y;
          const rn1: number = r1X * normalX + r1Y * normalY;
          const rn2: number = r2X * normalX + r2Y * normalY;
          let kNormal: number = b1.m_invMass + b2.m_invMass;
          kNormal = kNormal + (b1.m_invI * (r1Sqr - rn1 * rn1) + b2.m_invI * (r2Sqr - rn2 * rn2));
          ccp.normalMass = 1 / kNormal;
          let kEqualized: number = b1.m_mass * b1.m_invMass + b2.m_mass * b2.m_invMass;
          kEqualized =
            kEqualized + (b1.m_mass * b1.m_invI * (r1Sqr - rn1 * rn1) + b2.m_mass * b2.m_invI * (r2Sqr - rn2 * rn2));
          ccp.equalizedMass = 1 / kEqualized;
          const tangentX: number = normalY;
          const tangentY: number = -normalX;
          const rt1: number = r1X * tangentX + r1Y * tangentY;
          const rt2: number = r2X * tangentX + r2Y * tangentY;
          let kTangent: number = b1.m_invMass + b2.m_invMass;
          kTangent = kTangent + (b1.m_invI * (r1Sqr - rt1 * rt1) + b2.m_invI * (r2Sqr - rt2 * rt2));
          ccp.tangentMass = 1 / kTangent;
          ccp.velocityBias = 0;
          if (ccp.separation > 0) {
            ccp.velocityBias = -60 * ccp.separation;
          }
          const relVelX: number = v2X + -w2 * r2Y - v1X - -w1 * r1Y;
          const relVelY: number = v2Y + w2 * r2X - v1Y - w1 * r1X;
          const vRel: number = cc.normal.x * relVelX + cc.normal.y * relVelY;
          if (vRel < -b2Settings.b2_velocityThreshold) {
            ccp.velocityBias += -cc.restitution * vRel;
          }
          k++;
        }
        count++;
        j++;
      }
      i++;
    }
  }

  // b2ContactSolver.as:179-249
  public InitVelocityConstraints(step: b2TimeStep): void {
    let i = 0;
    while (i < this.m_constraintCount) {
      const c: b2ContactConstraint = this.m_constraints[i];
      const b1: b2Body = c.body1;
      const b2: b2Body = c.body2;
      const invMass1: number = b1.m_invMass;
      const invI1: number = b1.m_invI;
      const invMass2: number = b2.m_invMass;
      const invI2: number = b2.m_invI;
      const normalX: number = c.normal.x;
      const tangentX: number = c.normal.y;
      const normalY: number = c.normal.y;
      const tangentY: number = -normalX;
      if (step.warmStarting) {
        const pointCount: number = c.pointCount;
        let j = 0;
        while (j < pointCount) {
          const ccp: b2ContactConstraintPoint = c.points[j];
          ccp.normalImpulse *= step.dtRatio;
          ccp.tangentImpulse *= step.dtRatio;
          const px: number = ccp.normalImpulse * normalX + ccp.tangentImpulse * tangentX;
          const py: number = ccp.normalImpulse * normalY + ccp.tangentImpulse * tangentY;
          b1.m_angularVelocity -= invI1 * (ccp.r1.x * py - ccp.r1.y * px);
          b1.m_linearVelocity.x -= invMass1 * px;
          b1.m_linearVelocity.y -= invMass1 * py;
          b2.m_angularVelocity += invI2 * (ccp.r2.x * py - ccp.r2.y * px);
          b2.m_linearVelocity.x += invMass2 * px;
          b2.m_linearVelocity.y += invMass2 * py;
          j++;
        }
      } else {
        const pointCount: number = c.pointCount;
        let j = 0;
        while (j < pointCount) {
          const ccp: b2ContactConstraintPoint = c.points[j];
          ccp.normalImpulse = 0;
          ccp.tangentImpulse = 0;
          j++;
        }
      }
      i++;
    }
  }

  // b2ContactSolver.as:251-340
  public SolveVelocityConstraints(): void {
    let i = 0;
    while (i < this.m_constraintCount) {
      const c: b2ContactConstraint = this.m_constraints[i];
      const b1: b2Body = c.body1;
      const b2: b2Body = c.body2;
      let w1: number = b1.m_angularVelocity;
      let w2: number = b2.m_angularVelocity;
      const v1: b2Vec2 = b1.m_linearVelocity;
      const v2: b2Vec2 = b2.m_linearVelocity;
      const invMass1: number = b1.m_invMass;
      const invI1: number = b1.m_invI;
      const invMass2: number = b2.m_invMass;
      const invI2: number = b2.m_invI;
      const normalX: number = c.normal.x;
      const tangentX: number = c.normal.y;
      const normalY: number = c.normal.y;
      const tangentY: number = -normalX;
      const friction: number = c.friction;
      const pointCount: number = c.pointCount;
      let j = 0;
      while (j < pointCount) {
        const ccp: b2ContactConstraintPoint = c.points[j];
        const dvX: number = v2.x + -w2 * ccp.r2.y - v1.x - -w1 * ccp.r1.y;
        const dvY: number = v2.y + w2 * ccp.r2.x - v1.y - w1 * ccp.r1.x;
        const vn: number = dvX * normalX + dvY * normalY;
        let normalImpulse: number = -ccp.normalMass * (vn - ccp.velocityBias);
        const vt: number = dvX * tangentX + dvY * tangentY;
        let tangentImpulse: number = ccp.tangentMass * -vt;
        const newNormalImpulse: number = b2Math.b2Max(ccp.normalImpulse + normalImpulse, 0);
        normalImpulse = newNormalImpulse - ccp.normalImpulse;
        const maxFriction: number = friction * ccp.normalImpulse;
        const newTangentImpulse: number = b2Math.b2Clamp(ccp.tangentImpulse + tangentImpulse, -maxFriction, maxFriction);
        tangentImpulse = newTangentImpulse - ccp.tangentImpulse;
        const px: number = normalImpulse * normalX + tangentImpulse * tangentX;
        const py: number = normalImpulse * normalY + tangentImpulse * tangentY;
        v1.x -= invMass1 * px;
        v1.y -= invMass1 * py;
        w1 -= invI1 * (ccp.r1.x * py - ccp.r1.y * px);
        v2.x += invMass2 * px;
        v2.y += invMass2 * py;
        w2 += invI2 * (ccp.r2.x * py - ccp.r2.y * px);
        ccp.normalImpulse = newNormalImpulse;
        ccp.tangentImpulse = newTangentImpulse;
        j++;
      }
      b1.m_angularVelocity = w1;
      b2.m_angularVelocity = w2;
      i++;
    }
  }

  // b2ContactSolver.as:342-365
  public FinalizeVelocityConstraints(): void {
    let i = 0;
    while (i < this.m_constraintCount) {
      const c: b2ContactConstraint = this.m_constraints[i];
      const m: b2Manifold = c.manifold;
      let j = 0;
      while (j < c.pointCount) {
        const mp: b2ManifoldPoint = m.points[j];
        const ccp: b2ContactConstraintPoint = c.points[j];
        mp.normalImpulse = ccp.normalImpulse;
        mp.tangentImpulse = ccp.tangentImpulse;
        j++;
      }
      i++;
    }
  }

  // b2ContactSolver.as:367-470
  public SolvePositionConstraints(baumgarte: number): boolean {
    let minSeparation: number = 0;
    let i = 0;
    while (i < this.m_constraintCount) {
      const c: b2ContactConstraint = this.m_constraints[i];
      const b1: b2Body = c.body1;
      const b2: b2Body = c.body2;
      const b1c: b2Vec2 = b1.m_sweep.c;
      let b1a: number = b1.m_sweep.a;
      const b2c: b2Vec2 = b2.m_sweep.c;
      let b2a: number = b2.m_sweep.a;
      const invMass1: number = b1.m_mass * b1.m_invMass;
      const invI1: number = b1.m_mass * b1.m_invI;
      const invMass2: number = b2.m_mass * b2.m_invMass;
      const invI2: number = b2.m_mass * b2.m_invI;
      const normalX: number = c.normal.x;
      const normalY: number = c.normal.y;
      const pointCount: number = c.pointCount;
      let j = 0;
      while (j < pointCount) {
        const ccp: b2ContactConstraintPoint = c.points[j];
        let tMat: b2Mat22 = b1.m_xf.R;
        let tVec: b2Vec2 = b1.m_sweep.localCenter;
        let r1X: number = ccp.localAnchor1.x - tVec.x;
        let r1Y: number = ccp.localAnchor1.y - tVec.y;
        let tX: number = tMat.col1.x * r1X + tMat.col2.x * r1Y;
        r1Y = tMat.col1.y * r1X + tMat.col2.y * r1Y;
        r1X = tX;
        tMat = b2.m_xf.R;
        tVec = b2.m_sweep.localCenter;
        let r2X: number = ccp.localAnchor2.x - tVec.x;
        let r2Y: number = ccp.localAnchor2.y - tVec.y;
        tX = tMat.col1.x * r2X + tMat.col2.x * r2Y;
        r2Y = tMat.col1.y * r2X + tMat.col2.y * r2Y;
        r2X = tX;
        const p1X: number = b1c.x + r1X;
        const p1Y: number = b1c.y + r1Y;
        const p2X: number = b2c.x + r2X;
        const p2Y: number = b2c.y + r2Y;
        const dpX: number = p2X - p1X;
        const dpY: number = p2Y - p1Y;
        const separation: number = dpX * normalX + dpY * normalY + ccp.separation;
        minSeparation = b2Math.b2Min(minSeparation, separation);
        const C: number =
          baumgarte * b2Math.b2Clamp(separation + b2Settings.b2_linearSlop, -b2Settings.b2_maxLinearCorrection, 0);
        const impulse: number = -ccp.equalizedMass * C;
        const oldImpulse: number = ccp.positionImpulse;
        ccp.positionImpulse = b2Math.b2Max(oldImpulse + impulse, 0);
        const dImpulse: number = ccp.positionImpulse - oldImpulse;
        const pX: number = dImpulse * normalX;
        const pY: number = dImpulse * normalY;
        b1c.x -= invMass1 * pX;
        b1c.y -= invMass1 * pY;
        b1a -= invI1 * (r1X * pY - r1Y * pX);
        b1.m_sweep.a = b1a;
        b1.SynchronizeTransform();
        b2c.x += invMass2 * pX;
        b2c.y += invMass2 * pY;
        b2a += invI2 * (r2X * pY - r2Y * pX);
        b2.m_sweep.a = b2a;
        b2.SynchronizeTransform();
        j++;
      }
      i++;
    }
    return minSeparation >= -1.5 * b2Settings.b2_linearSlop;
  }
}
