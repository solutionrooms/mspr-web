// Port of Box2D/Dynamics/b2World.as (Box2DFlash 2.0.2), grown milestone-by-milestone.
// The freefall path is complete & faithful: constructor, CreateBody, Step, Solve
// (island assembly + integrate), and the empty-contact SolveTOI reset loops.
//
// Op order preserved exactly. Methods that belong to later milestones (the TOI
// resolve loop -> m7, debug draw / raycast / query -> as needed, joint solving -> m6)
// are guarded `notPorted` and only fire once their feature is exercised. For the
// freefall goldens (m0/m1) none of those guards are reached.
import { b2AABB } from "../Collision/b2AABB";
import { b2BroadPhase } from "../Collision/b2BroadPhase";
import { b2Vec2 } from "../Common/Math/b2Vec2";
import { b2Body } from "./b2Body";
import { b2BodyDef } from "./b2BodyDef";
import { b2ContactManager } from "./b2ContactManager";
import { b2ContactFilter } from "./b2ContactFilter";
import { b2Contact } from "./Contacts/b2Contact";
import { b2Island } from "./b2Island";
import { b2TimeStep } from "./b2TimeStep";
import { b2Settings } from "../Common/b2Settings";
import type { b2Joint } from "./Joints/b2Joint";
import type { b2JointDef } from "./Joints/b2JointDef";
import type { b2ContactEdge } from "./Contacts/b2ContactEdge";
import type { b2JointEdge } from "./Joints/b2JointEdge";
import type { b2ContactListener } from "./b2ContactListener";
import { notPorted } from "../_internal/notPorted";

export class b2World {
  // b2World.as:13-17 (static solver toggles)
  public static m_positionCorrection: boolean;
  public static m_warmStarting: boolean;
  public static m_continuousPhysics: boolean;

  public m_blockAllocator: unknown;
  public m_stackAllocator: unknown;
  public m_lock!: boolean;
  public m_broadPhase!: b2BroadPhase;
  public m_contactManager: b2ContactManager = new b2ContactManager();
  public m_bodyList: b2Body | null = null;
  public m_jointList: b2Joint | null = null;
  public m_contactList: b2Contact | null = null;
  public m_bodyCount!: number;
  public m_contactCount!: number;
  public m_jointCount!: number;
  public m_gravity!: b2Vec2;
  public m_allowSleep!: boolean;
  public m_groundBody!: b2Body;
  public m_contactFilter!: b2ContactFilter | null;
  public m_contactListener: b2ContactListener | null = null;
  public m_inv_dt0!: number;
  public m_positionIterationCount!: number;

  // b2World.as:73-98
  constructor(worldAABB: b2AABB, gravity: b2Vec2, doSleep: boolean) {
    this.m_contactFilter = b2ContactFilter.b2_defaultFilter;
    this.m_contactListener = null;
    this.m_bodyList = null;
    this.m_contactList = null;
    this.m_jointList = null;
    this.m_bodyCount = 0;
    this.m_contactCount = 0;
    this.m_jointCount = 0;
    b2World.m_positionCorrection = true;
    b2World.m_warmStarting = true;
    b2World.m_continuousPhysics = true;
    this.m_allowSleep = doSleep;
    this.m_gravity = gravity;
    this.m_lock = false;
    this.m_inv_dt0 = 0;
    this.m_contactManager.m_world = this;
    this.m_broadPhase = new b2BroadPhase(worldAABB, this.m_contactManager);
    const bd: b2BodyDef = new b2BodyDef();
    this.m_groundBody = this.CreateBody(bd)!;
  }

  // b2World.as:100-123 (listener/filter/debug setters)
  public SetDestructionListener(_listener: unknown): void {
    // m_destructionListener used by DestroyBody/DestroyJoint; stored when needed (m6).
    notPorted("b2World.SetDestructionListener (m6: joints/destruction)");
  }
  public SetBoundaryListener(_listener: unknown): void {
    notPorted("b2World.SetBoundaryListener (m5: boundary)");
  }
  public SetContactFilter(filter: b2ContactFilter): void {
    this.m_contactFilter = filter;
  }
  public SetContactListener(listener: b2ContactListener): void {
    this.m_contactListener = listener;
  }
  public SetDebugDraw(_debugDraw: unknown): void {
    notPorted("b2World.SetDebugDraw (debug rendering — not part of headless sim)");
  }

  // b2World.as:130-138
  public GetProxyCount(): number {
    return this.m_broadPhase.m_proxyCount;
  }

  // b2World.as:140-156
  public CreateBody(bd: b2BodyDef): b2Body | null {
    if (this.m_lock === true) {
      return null;
    }
    const b: b2Body = new b2Body(bd, this);
    b.m_prev = null;
    b.m_next = this.m_bodyList;
    if (this.m_bodyList) {
      this.m_bodyList.m_prev = b;
    }
    this.m_bodyList = b;
    ++this.m_bodyCount;
    return b;
  }

  // b2World.as:158-202
  public DestroyBody(b: b2Body): void {
    if (this.m_lock === true) {
      return;
    }
    let jn: b2JointEdge | null = b.m_jointList;
    while (jn) {
      const jn0: b2JointEdge = jn;
      jn = jn.next;
      // m_destructionListener notification (m6) skipped until set
      this.DestroyJoint(jn0.joint!);
    }
    let s = b.m_shapeList;
    while (s) {
      const s0 = s;
      s = s.m_next;
      // m_destructionListener notification (m6) skipped until set
      s0.DestroyProxy(this.m_broadPhase);
      // b2Shape.Destroy(s0, this.m_blockAllocator) — via shape lifecycle (m2)
    }
    if (b.m_prev) {
      b.m_prev.m_next = b.m_next;
    }
    if (b.m_next) {
      b.m_next.m_prev = b.m_prev;
    }
    if (b === this.m_bodyList) {
      this.m_bodyList = b.m_next;
    }
    --this.m_bodyCount;
  }

  // b2World.as:204-309 — joint lifecycle. Ported at m6 (joints).
  public CreateJoint(_def: b2JointDef): b2Joint {
    return notPorted("b2World.CreateJoint (m6: joints)");
  }
  public DestroyJoint(_joint: b2Joint): void {
    notPorted("b2World.DestroyJoint (m6: joints)");
  }

  // b2World.as:316-318/321-323/326-328
  public SetWarmStarting(flag: boolean): void {
    b2World.m_warmStarting = flag;
  }
  public SetPositionCorrection(flag: boolean): void {
    b2World.m_positionCorrection = flag;
  }
  public SetContinuousPhysics(flag: boolean): void {
    b2World.m_continuousPhysics = flag;
  }

  // b2World.as:331-339
  public GetBodyCount(): number {
    return this.m_bodyCount;
  }
  public GetJointCount(): number {
    return this.m_jointCount;
  }
  public GetContactCount(): number {
    return this.m_contactCount;
  }

  // b2World.as:346-354
  public SetGravity(gravity: b2Vec2): void {
    this.m_gravity = gravity;
  }
  public GetGroundBody(): b2Body {
    return this.m_groundBody;
  }

  // b2World.as:356-385
  public Step(dt: number, iterations: number): void {
    this.m_lock = true;
    const step: b2TimeStep = new b2TimeStep();
    step.dt = dt;
    step.maxIterations = iterations;
    if (dt > 0) {
      step.inv_dt = 1 / dt;
    } else {
      step.inv_dt = 0;
    }
    step.dtRatio = this.m_inv_dt0 * dt;
    step.positionCorrection = b2World.m_positionCorrection;
    step.warmStarting = b2World.m_warmStarting;
    this.m_contactManager.Collide();
    if (step.dt > 0) {
      this.Solve(step);
    }
    if (b2World.m_continuousPhysics && step.dt > 0) {
      this.SolveTOI(step);
    }
    this.DrawDebugData();
    this.m_inv_dt0 = step.inv_dt;
    this.m_lock = false;
  }

  // b2World.as:432-440
  public GetBodyList(): b2Body | null {
    return this.m_bodyList;
  }
  public GetJointList(): b2Joint | null {
    return this.m_jointList;
  }

  // b2World.as:442-566
  public Solve(step: b2TimeStep): void {
    let b: b2Body | null = null;
    let stackCount: number = 0;
    let i: number = 0;
    let other: b2Body | null = null;
    let cn: b2ContactEdge | null = null;
    let jn: b2JointEdge | null = null;
    let inRange: boolean = false;

    this.m_positionIterationCount = 0;
    const island: b2Island = new b2Island(
      this.m_bodyCount,
      this.m_contactCount,
      this.m_jointCount,
      this.m_stackAllocator,
      this.m_contactListener,
    );
    b = this.m_bodyList;
    while (b) {
      b.m_flags &= ~b2Body.e_islandFlag;
      b = b.m_next;
    }
    let c: b2Contact | null = this.m_contactList;
    while (c) {
      c.m_flags &= ~b2Contact.e_islandFlag;
      c = c.m_next;
    }
    let j: b2Joint | null = this.m_jointList;
    while (j) {
      j.m_islandFlag = false;
      j = j.m_next;
    }
    const stackSize: number = this.m_bodyCount;
    const stack: (b2Body | null)[] = new Array(stackSize);
    let seed: b2Body | null = this.m_bodyList;
    while (seed) {
      if (!(seed.m_flags & (b2Body.e_islandFlag | b2Body.e_sleepFlag | b2Body.e_frozenFlag))) {
        if (!seed.IsStatic()) {
          island.Clear();
          stackCount = 0;
          stack[stackCount++] = seed;
          seed.m_flags |= b2Body.e_islandFlag;
          while (stackCount > 0) {
            b = stack[--stackCount];
            island.AddBody(b!);
            b!.m_flags &= ~b2Body.e_sleepFlag;
            if (!b!.IsStatic()) {
              cn = b!.m_contactList;
              while (cn) {
                if (!(cn.contact!.m_flags & (b2Contact.e_islandFlag | b2Contact.e_nonSolidFlag))) {
                  if (cn.contact!.m_manifoldCount !== 0) {
                    island.AddContact(cn.contact!);
                    cn.contact!.m_flags |= b2Contact.e_islandFlag;
                    other = cn.other;
                    if (!(other!.m_flags & b2Body.e_islandFlag)) {
                      stack[stackCount++] = other;
                      other!.m_flags |= b2Body.e_islandFlag;
                    }
                  }
                }
                cn = cn.next;
              }
              jn = b!.m_jointList;
              while (jn) {
                if (jn.joint!.m_islandFlag !== true) {
                  island.AddJoint(jn.joint!);
                  jn.joint!.m_islandFlag = true;
                  other = jn.other;
                  if (!(other!.m_flags & b2Body.e_islandFlag)) {
                    stack[stackCount++] = other;
                    other!.m_flags |= b2Body.e_islandFlag;
                  }
                }
                jn = jn.next;
              }
            }
          }
          island.Solve(step, this.m_gravity, b2World.m_positionCorrection, this.m_allowSleep);
          if (island.m_positionIterationCount > this.m_positionIterationCount) {
            this.m_positionIterationCount = island.m_positionIterationCount;
          }
          i = 0;
          while (i < island.m_bodyCount) {
            b = island.m_bodies[i];
            if (b!.IsStatic()) {
              b!.m_flags &= ~b2Body.e_islandFlag;
            }
            i++;
          }
        }
      }
      seed = seed.m_next;
    }
    b = this.m_bodyList;
    while (b) {
      if (!(b.m_flags & (b2Body.e_sleepFlag | b2Body.e_frozenFlag))) {
        if (!b.IsStatic()) {
          inRange = b.SynchronizeShapes();
          if (inRange === false && this.m_boundaryListener != null) {
            this.m_boundaryListener.Violation(b);
          }
        }
      }
      b = b.m_next;
    }
    this.m_broadPhase.Commit();
  }

  // boundary listener slot (set via SetBoundaryListener at m5)
  public m_boundaryListener: { Violation(b: b2Body): void } | null = null;

  // b2World.as:568-757 — continuous collision. The reset loops are faithful; the
  // TOI candidate-scan + sub-step resolve are ported at m7 (CCD/TOI). With an empty
  // contact list the original immediately finds no candidate and breaks, so the
  // resolve loop is a no-op here.
  public SolveTOI(_step: b2TimeStep): void {
    let b: b2Body | null = this.m_bodyList;
    while (b) {
      b.m_flags &= ~b2Body.e_islandFlag;
      b.m_sweep.t0 = 0;
      b = b.m_next;
    }
    let c: b2Contact | null = this.m_contactList;
    while (c) {
      c.m_flags &= ~(b2Contact.e_toiFlag | b2Contact.e_islandFlag);
      c = c.m_next;
    }
    if (this.m_contactList != null) {
      notPorted("b2World.SolveTOI candidate scan + resolve (m7: CCD/TOI)");
    }
  }

  // b2World.as:854-1040 — debug rendering. Headless sim never sets a debug draw, so
  // this returns immediately (faithful). The rendering body is out of engine scope.
  public DrawDebugData(): void {
    if (this.m_debugDraw == null) {
      return;
    }
    notPorted("b2World.DrawDebugData body (debug rendering — out of engine scope)");
  }
  public m_debugDraw: unknown = null;
}
