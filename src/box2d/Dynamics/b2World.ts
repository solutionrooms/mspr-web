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
import { b2TimeOfImpact } from "../Collision/b2TimeOfImpact";
import type { b2Shape } from "../Collision/Shapes/b2Shape";
import { b2Joint } from "./Joints/b2Joint";
import type { b2JointDef } from "./Joints/b2JointDef";
// Side-effect imports: register the concrete joint types with the joint factory so
// b2Joint.Create(def) can dispatch. FZ3 creates revolute/prismatic/distance/mouse;
// pulley/gear are ported for completeness (the pulley def is built but never turned
// into a joint by PhysicsBase, and gear is unused).
import "./Joints/b2RevoluteJoint";
import "./Joints/b2PrismaticJoint";
import "./Joints/b2DistanceJoint";
import "./Joints/b2MouseJoint";
import "./Joints/b2PulleyJoint";
import "./Joints/b2GearJoint";
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

  // b2World.as:204-246
  public CreateJoint(def: b2JointDef): b2Joint {
    const joint: b2Joint = b2Joint.Create(def, this.m_blockAllocator);
    joint.m_prev = null;
    joint.m_next = this.m_jointList;
    if (this.m_jointList) {
      this.m_jointList.m_prev = joint;
    }
    this.m_jointList = joint;
    ++this.m_jointCount;
    joint.m_node1.joint = joint;
    joint.m_node1.other = joint.m_body2;
    joint.m_node1.prev = null;
    joint.m_node1.next = joint.m_body1.m_jointList;
    if (joint.m_body1.m_jointList) {
      joint.m_body1.m_jointList.prev = joint.m_node1;
    }
    joint.m_body1.m_jointList = joint.m_node1;
    joint.m_node2.joint = joint;
    joint.m_node2.other = joint.m_body1;
    joint.m_node2.prev = null;
    joint.m_node2.next = joint.m_body2.m_jointList;
    if (joint.m_body2.m_jointList) {
      joint.m_body2.m_jointList.prev = joint.m_node2;
    }
    joint.m_body2.m_jointList = joint.m_node2;
    if (def.collideConnected === false) {
      const body: b2Body = def.body1!.m_shapeCount < def.body2!.m_shapeCount ? def.body1! : def.body2!;
      let s: b2Shape | null = body.m_shapeList;
      while (s) {
        s.RefilterProxy(this.m_broadPhase, body.m_xf);
        s = s.m_next;
      }
    }
    return joint;
  }

  // b2World.as:248-309
  public DestroyJoint(joint: b2Joint): void {
    const collideConnected: boolean = joint.m_collideConnected;
    if (joint.m_prev) {
      joint.m_prev.m_next = joint.m_next;
    }
    if (joint.m_next) {
      joint.m_next.m_prev = joint.m_prev;
    }
    if (joint === this.m_jointList) {
      this.m_jointList = joint.m_next;
    }
    const body1: b2Body = joint.m_body1;
    const body2: b2Body = joint.m_body2;
    body1.WakeUp();
    body2.WakeUp();
    if (joint.m_node1.prev) {
      joint.m_node1.prev.next = joint.m_node1.next;
    }
    if (joint.m_node1.next) {
      joint.m_node1.next.prev = joint.m_node1.prev;
    }
    if (joint.m_node1 === body1.m_jointList) {
      body1.m_jointList = joint.m_node1.next;
    }
    joint.m_node1.prev = null;
    joint.m_node1.next = null;
    if (joint.m_node2.prev) {
      joint.m_node2.prev.next = joint.m_node2.next;
    }
    if (joint.m_node2.next) {
      joint.m_node2.next.prev = joint.m_node2.prev;
    }
    if (joint.m_node2 === body2.m_jointList) {
      body2.m_jointList = joint.m_node2.next;
    }
    joint.m_node2.prev = null;
    joint.m_node2.next = null;
    b2Joint.Destroy(joint, this.m_blockAllocator);
    --this.m_jointCount;
    if (collideConnected === false) {
      const body: b2Body = body1.m_shapeCount < body2.m_shapeCount ? body1 : body2;
      let s: b2Shape | null = body.m_shapeList;
      while (s) {
        s.RefilterProxy(this.m_broadPhase, body.m_xf);
        s = s.m_next;
      }
    }
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

  // b2World.as:568-757 — continuous collision. Repeatedly find the earliest TOI among
  // all fast (non-slow, solid) contacts, advance both bodies to it, re-solve ONLY that
  // swept island for the remaining sub-step, and repeat. The island assembly advances
  // each newly-reached non-static body to the TOI and wakes it (SB2 traps preserved:
  // re-solve only the swept pair; advance BOTH sweeps; static/sleeping pairs skipped).
  public SolveTOI(step: b2TimeStep): void {
    const island: b2Island = new b2Island(
      this.m_bodyCount,
      b2Settings.b2_maxTOIContactsPerIsland,
      0,
      this.m_stackAllocator,
      this.m_contactListener,
    );
    const queueCapacity: number = this.m_bodyCount;
    const queue: (b2Body | null)[] = new Array(queueCapacity);
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
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let minContact: b2Contact | null = null;
      let minTOI: number = 1;
      c = this.m_contactList;
      for (; c; c = c.m_next) {
        if (!(c.m_flags & (b2Contact.e_slowFlag | b2Contact.e_nonSolidFlag))) {
          let toi: number = 1;
          if (c.m_flags & b2Contact.e_toiFlag) {
            toi = c.m_toi;
          } else {
            const s1: b2Shape = c.m_shape1!;
            const s2: b2Shape = c.m_shape2!;
            const b1: b2Body = s1.m_body!;
            const b2: b2Body = s2.m_body!;
            if ((b1.IsStatic() || b1.IsSleeping()) && (b2.IsStatic() || b2.IsSleeping())) {
              continue;
            }
            let t0: number = b1.m_sweep.t0;
            if (b1.m_sweep.t0 < b2.m_sweep.t0) {
              t0 = b2.m_sweep.t0;
              b1.m_sweep.Advance(t0);
            } else if (b2.m_sweep.t0 < b1.m_sweep.t0) {
              t0 = b1.m_sweep.t0;
              b2.m_sweep.Advance(t0);
            }
            toi = b2TimeOfImpact.TimeOfImpact(c.m_shape1!, b1.m_sweep, c.m_shape2!, b2.m_sweep);
            if (toi > 0 && toi < 1) {
              toi = (1 - toi) * t0 + toi;
              if (toi > 1) {
                toi = 1;
              }
            }
            c.m_toi = toi;
            c.m_flags |= b2Contact.e_toiFlag;
          }
          if (Number.MIN_VALUE < toi && toi < minTOI) {
            minContact = c;
            minTOI = toi;
          }
        }
      }
      if (minContact == null || 1 - 100 * Number.MIN_VALUE < minTOI) {
        break;
      }
      const s1: b2Shape = minContact.m_shape1!;
      const s2: b2Shape = minContact.m_shape2!;
      const b1: b2Body = s1.m_body!;
      const b2: b2Body = s2.m_body!;
      b1.Advance(minTOI);
      b2.Advance(minTOI);
      minContact.Update(this.m_contactListener);
      minContact.m_flags &= ~b2Contact.e_toiFlag;
      if (minContact.m_manifoldCount !== 0) {
        let seed: b2Body = b1;
        if (seed.IsStatic()) {
          seed = b2;
        }
        island.Clear();
        let queueSize: number = 0;
        queue[queueSize++] = seed;
        seed.m_flags |= b2Body.e_islandFlag;
        while (queueSize > 0) {
          b = queue[--queueSize];
          island.AddBody(b!);
          b!.m_flags &= ~b2Body.e_sleepFlag;
          if (!b!.IsStatic()) {
            let cn: b2ContactEdge | null = b!.m_contactList;
            while (cn) {
              if (island.m_contactCount !== island.m_contactCapacity) {
                if (!(cn.contact!.m_flags & (b2Contact.e_islandFlag | b2Contact.e_slowFlag | b2Contact.e_nonSolidFlag))) {
                  if (cn.contact!.m_manifoldCount !== 0) {
                    island.AddContact(cn.contact!);
                    cn.contact!.m_flags |= b2Contact.e_islandFlag;
                    const other: b2Body = cn.other!;
                    if (!(other.m_flags & b2Body.e_islandFlag)) {
                      if (other.IsStatic() === false) {
                        other.Advance(minTOI);
                        other.WakeUp();
                      }
                      queue[queueSize++] = other;
                      other.m_flags |= b2Body.e_islandFlag;
                    }
                  }
                }
              }
              cn = cn.next;
            }
          }
        }
        const subStep: b2TimeStep = new b2TimeStep();
        subStep.dt = (1 - minTOI) * step.dt;
        subStep.inv_dt = 1 / subStep.dt;
        subStep.maxIterations = step.maxIterations;
        island.SolveTOI(subStep);
        let i: number = 0;
        while (i < island.m_bodyCount) {
          b = island.m_bodies[i];
          b!.m_flags &= ~b2Body.e_islandFlag;
          if (!(b!.m_flags & (b2Body.e_sleepFlag | b2Body.e_frozenFlag))) {
            if (!b!.IsStatic()) {
              const inRange: boolean = b!.SynchronizeShapes();
              if (inRange === false && this.m_boundaryListener != null) {
                this.m_boundaryListener.Violation(b!);
              }
              let cn: b2ContactEdge | null = b!.m_contactList;
              while (cn) {
                cn.contact!.m_flags &= ~b2Contact.e_toiFlag;
                cn = cn.next;
              }
            }
          }
          i++;
        }
        i = 0;
        while (i < island.m_contactCount) {
          const ci: b2Contact = island.m_contacts[i]!;
          ci.m_flags &= ~(b2Contact.e_toiFlag | b2Contact.e_islandFlag);
          i++;
        }
        this.m_broadPhase.Commit();
      }
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
