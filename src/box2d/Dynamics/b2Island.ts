// Port of Box2D/Dynamics/b2Island.as (Box2DFlash 2.0.2), line-by-line.
// Solve() is the integrator + the 2.0.x inline-Baumgarte iteration model and the
// island sleep logic. Report() emits contact results to the listener. Op order preserved.
//
// SolveTOI()'s sub-step solve is ported at m7 (CCD/TOI) — guarded `notPorted` until then.
import { b2Math } from "../Common/Math/b2Math";
import { b2Settings } from "../Common/b2Settings";
import { b2Body } from "./b2Body";
import { b2ContactSolver } from "./Contacts/b2ContactSolver";
import { b2ContactResult } from "./Contacts/b2ContactResult";
import type { b2ContactConstraint } from "./Contacts/b2ContactConstraint";
import type { b2ContactConstraintPoint } from "./Contacts/b2ContactConstraintPoint";
import type { b2Manifold } from "../Collision/b2Manifold";
import type { b2ManifoldPoint } from "../Collision/b2ManifoldPoint";
import type { b2TimeStep } from "./b2TimeStep";
import type { b2Vec2 } from "../Common/Math/b2Vec2";
import type { b2Contact } from "./Contacts/b2Contact";
import type { b2Joint } from "./Joints/b2Joint";
import type { b2ContactListener } from "./b2ContactListener";
import { notPorted } from "../_internal/notPorted";

export class b2Island {
  // b2Island.as:12
  private static s_reportCR: b2ContactResult = new b2ContactResult();

  public m_allocator: unknown;
  public m_listener: b2ContactListener | null;
  public m_bodies: (b2Body | null)[];
  public m_contacts: (b2Contact | null)[];
  public m_joints: (b2Joint | null)[];
  public m_bodyCount: number;
  public m_jointCount: number;
  public m_contactCount: number;
  public m_bodyCapacity: number;
  public m_contactCapacity: number;
  public m_jointCapacity: number;
  public m_positionIterationCount: number;

  // b2Island.as:38-72
  constructor(
    bodyCapacity: number,
    contactCapacity: number,
    jointCapacity: number,
    allocator: unknown,
    listener: b2ContactListener | null,
  ) {
    this.m_bodyCapacity = bodyCapacity;
    this.m_contactCapacity = contactCapacity;
    this.m_jointCapacity = jointCapacity;
    this.m_bodyCount = 0;
    this.m_contactCount = 0;
    this.m_jointCount = 0;
    this.m_allocator = allocator;
    this.m_listener = listener;
    this.m_bodies = new Array(bodyCapacity);
    for (let i = 0; i < bodyCapacity; i++) {
      this.m_bodies[i] = null;
    }
    this.m_contacts = new Array(contactCapacity);
    for (let i = 0; i < contactCapacity; i++) {
      this.m_contacts[i] = null;
    }
    this.m_joints = new Array(jointCapacity);
    for (let i = 0; i < jointCapacity; i++) {
      this.m_joints[i] = null;
    }
    this.m_positionIterationCount = 0;
  }

  // b2Island.as:74-79
  public Clear(): void {
    this.m_bodyCount = 0;
    this.m_contactCount = 0;
    this.m_jointCount = 0;
  }

  // b2Island.as:81-236
  public Solve(step: b2TimeStep, gravity: b2Vec2, correctPositions: boolean, allowSleep: boolean): void {
    let i: number = 0;
    let b: b2Body | null = null;
    let joint: b2Joint | null = null;

    i = 0;
    while (i < this.m_bodyCount) {
      b = this.m_bodies[i];
      if (!b!.IsStatic()) {
        b!.m_linearVelocity.x += step.dt * (gravity.x + b!.m_invMass * b!.m_force.x);
        b!.m_linearVelocity.y += step.dt * (gravity.y + b!.m_invMass * b!.m_force.y);
        b!.m_angularVelocity += step.dt * b!.m_invI * b!.m_torque;
        b!.m_force.SetZero();
        b!.m_torque = 0;
        b!.m_linearVelocity.Multiply(b2Math.b2Clamp(1 - step.dt * b!.m_linearDamping, 0, 1));
        b!.m_angularVelocity *= b2Math.b2Clamp(1 - step.dt * b!.m_angularDamping, 0, 1);
        if (b!.m_linearVelocity.LengthSquared() > b2Settings.b2_maxLinearVelocitySquared) {
          b!.m_linearVelocity.Normalize();
          b!.m_linearVelocity.x *= b2Settings.b2_maxLinearVelocity;
          b!.m_linearVelocity.y *= b2Settings.b2_maxLinearVelocity;
        }
        if (b!.m_angularVelocity * b!.m_angularVelocity > b2Settings.b2_maxAngularVelocitySquared) {
          if (b!.m_angularVelocity < 0) {
            b!.m_angularVelocity = -b2Settings.b2_maxAngularVelocity;
          } else {
            b!.m_angularVelocity = b2Settings.b2_maxAngularVelocity;
          }
        }
      }
      i++;
    }

    const contactSolver: b2ContactSolver = new b2ContactSolver(
      step,
      this.m_contacts as b2Contact[],
      this.m_contactCount,
      this.m_allocator,
    );
    contactSolver.InitVelocityConstraints(step);
    i = 0;
    while (i < this.m_jointCount) {
      joint = this.m_joints[i];
      joint!.InitVelocityConstraints(step);
      i++;
    }
    i = 0;
    while (i < step.maxIterations) {
      contactSolver.SolveVelocityConstraints();
      let j: number = 0;
      while (j < this.m_jointCount) {
        joint = this.m_joints[j];
        joint!.SolveVelocityConstraints(step);
        j++;
      }
      i++;
    }
    contactSolver.FinalizeVelocityConstraints();
    i = 0;
    while (i < this.m_bodyCount) {
      b = this.m_bodies[i];
      if (!b!.IsStatic()) {
        b!.m_sweep.c0.SetV(b!.m_sweep.c);
        b!.m_sweep.a0 = b!.m_sweep.a;
        b!.m_sweep.c.x += step.dt * b!.m_linearVelocity.x;
        b!.m_sweep.c.y += step.dt * b!.m_linearVelocity.y;
        b!.m_sweep.a += step.dt * b!.m_angularVelocity;
        b!.SynchronizeTransform();
      }
      i++;
    }
    if (correctPositions) {
      i = 0;
      while (i < this.m_jointCount) {
        joint = this.m_joints[i];
        joint!.InitPositionConstraints();
        i++;
      }
      this.m_positionIterationCount = 0;
      while (this.m_positionIterationCount < step.maxIterations) {
        const contactsOkay: boolean = contactSolver.SolvePositionConstraints(b2Settings.b2_contactBaumgarte);
        let jointsOkay: boolean = true;
        i = 0;
        while (i < this.m_jointCount) {
          joint = this.m_joints[i];
          const jointOkay: boolean = joint!.SolvePositionConstraints();
          jointsOkay = jointsOkay && jointOkay;
          i++;
        }
        if (contactsOkay && jointsOkay) {
          break;
        }
        ++this.m_positionIterationCount;
      }
    }
    this.Report(contactSolver.m_constraints);
    if (allowSleep) {
      let minSleepTime: number = Number.MAX_VALUE;
      const linTolSqr: number = b2Settings.b2_linearSleepTolerance * b2Settings.b2_linearSleepTolerance;
      const angTolSqr: number = b2Settings.b2_angularSleepTolerance * b2Settings.b2_angularSleepTolerance;
      i = 0;
      while (i < this.m_bodyCount) {
        b = this.m_bodies[i];
        if (b!.m_invMass !== 0) {
          if ((b!.m_flags & b2Body.e_allowSleepFlag) === 0) {
            b!.m_sleepTime = 0;
            minSleepTime = 0;
          }
          if (
            (b!.m_flags & b2Body.e_allowSleepFlag) === 0 ||
            b!.m_angularVelocity * b!.m_angularVelocity > angTolSqr ||
            b2Math.b2Dot(b!.m_linearVelocity, b!.m_linearVelocity) > linTolSqr
          ) {
            b!.m_sleepTime = 0;
            minSleepTime = 0;
          } else {
            b!.m_sleepTime += step.dt;
            minSleepTime = b2Math.b2Min(minSleepTime, b!.m_sleepTime);
          }
        }
        i++;
      }
      if (minSleepTime >= b2Settings.b2_timeToSleep) {
        i = 0;
        while (i < this.m_bodyCount) {
          b = this.m_bodies[i];
          b!.m_flags |= b2Body.e_sleepFlag;
          b!.m_linearVelocity.SetZero();
          b!.m_angularVelocity = 0;
          i++;
        }
      }
    }
  }

  // b2Island.as:238-277 — TOI sub-step solve. NO gravity integration and NO
  // warm-start/InitVelocityConstraints (unlike Solve): just resolve velocity
  // constraints, advance positions for the sub-step, position-correct with the
  // TOI Baumgarte (0.75), then report.
  public SolveTOI(subStep: b2TimeStep): void {
    const contactSolver: b2ContactSolver = new b2ContactSolver(
      subStep,
      this.m_contacts as b2Contact[],
      this.m_contactCount,
      this.m_allocator,
    );
    let i = 0;
    while (i < subStep.maxIterations) {
      contactSolver.SolveVelocityConstraints();
      i++;
    }
    i = 0;
    while (i < this.m_bodyCount) {
      const b: b2Body = this.m_bodies[i]!;
      if (!b.IsStatic()) {
        b.m_sweep.c0.SetV(b.m_sweep.c);
        b.m_sweep.a0 = b.m_sweep.a;
        b.m_sweep.c.x += subStep.dt * b.m_linearVelocity.x;
        b.m_sweep.c.y += subStep.dt * b.m_linearVelocity.y;
        b.m_sweep.a += subStep.dt * b.m_angularVelocity;
        b.SynchronizeTransform();
      }
      i++;
    }
    const k_toiBaumgarte: number = 0.75;
    i = 0;
    while (i < subStep.maxIterations) {
      const contactsOkay: boolean = contactSolver.SolvePositionConstraints(k_toiBaumgarte);
      if (contactsOkay) {
        break;
      }
      i++;
    }
    this.Report(contactSolver.m_constraints);
  }

  // b2Island.as:279-330 — contact-result reporting to the listener.
  public Report(constraints: b2ContactConstraint[]): void {
    if (this.m_listener == null) {
      return;
    }
    let i = 0;
    while (i < this.m_contactCount) {
      const c: b2Contact = this.m_contacts[i]!;
      const cc: b2ContactConstraint = constraints[i];
      const cr: b2ContactResult = b2Island.s_reportCR;
      cr.shape1 = c.m_shape1;
      cr.shape2 = c.m_shape2;
      const b1: b2Body = cr.shape1!.m_body!;
      const manifoldCount: number = c.m_manifoldCount;
      const manifolds: b2Manifold[] = c.GetManifolds()!;
      let j = 0;
      while (j < manifoldCount) {
        const manifold: b2Manifold = manifolds[j];
        cr.normal.SetV(manifold.normal);
        let k = 0;
        while (k < manifold.pointCount) {
          const mp: b2ManifoldPoint = manifold.points[k];
          const ccp: b2ContactConstraintPoint = cc.points[k];
          cr.position = b1.GetWorldPoint(mp.localPoint1);
          cr.normalImpulse = ccp.normalImpulse;
          cr.tangentImpulse = ccp.tangentImpulse;
          cr.id.key = mp.id.key;
          this.m_listener.Result(cr);
          k++;
        }
        j++;
      }
      i++;
    }
  }

  // b2Island.as:332-335
  public AddBody(b: b2Body): void {
    this.m_bodies[this.m_bodyCount++] = b;
  }

  // b2Island.as:337-340
  public AddContact(c: b2Contact): void {
    this.m_contacts[this.m_contactCount++] = c;
  }

  // b2Island.as:342-345
  public AddJoint(j: b2Joint): void {
    this.m_joints[this.m_jointCount++] = j;
  }
}
