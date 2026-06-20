// Port of Box2D/Dynamics/Contacts/b2Contact.as (Box2DFlash 2.0.2), line-by-line.
// Base contact: the shape-type registry (Create dispatch + primary/swap normal-negate),
// the friction/restitution mix in the ctor, and Update (Evaluate + slow-flag + wake
// transitions). Subclasses override Evaluate/GetManifolds. Op order preserved.
import { b2Math } from "../../Common/Math/b2Math";
import { b2Shape } from "../../Collision/Shapes/b2Shape";
import type { b2Manifold } from "../../Collision/b2Manifold";
import type { b2ContactListener } from "../b2ContactListener";
import type { b2Body } from "../b2Body";
import { b2ContactEdge } from "./b2ContactEdge";
import { b2ContactRegister, type ContactCreateFcn, type ContactDestroyFcn } from "./b2ContactRegister";
import { getContactTypeRegistrations } from "./_contactFactory";

export class b2Contact {
  // b2Contact.as:12-22
  public static s_registers: b2ContactRegister[][];
  public static readonly e_nonSolidFlag: number = 1;
  public static readonly e_slowFlag: number = 2;
  public static readonly e_islandFlag: number = 4;
  public static readonly e_toiFlag: number = 8;
  public static s_initialized: boolean = false;

  public m_flags!: number;
  public m_prev: b2Contact | null = null;
  public m_next: b2Contact | null = null;
  public m_node1: b2ContactEdge = new b2ContactEdge();
  public m_node2: b2ContactEdge = new b2ContactEdge();
  public m_shape1: b2Shape | null = null;
  public m_shape2: b2Shape | null = null;
  public m_manifoldCount: number = 0;
  public m_friction!: number;
  public m_restitution!: number;
  public m_toi!: number;

  // b2Contact.as:46-75
  constructor(shape1: b2Shape | null = null, shape2: b2Shape | null = null) {
    this.m_flags = 0;
    if (!shape1 || !shape2) {
      this.m_shape1 = null;
      this.m_shape2 = null;
      return;
    }
    if (shape1.IsSensor() || shape2.IsSensor()) {
      this.m_flags |= b2Contact.e_nonSolidFlag;
    }
    this.m_shape1 = shape1;
    this.m_shape2 = shape2;
    this.m_manifoldCount = 0;
    this.m_friction = Math.sqrt(this.m_shape1.m_friction * this.m_shape2.m_friction);
    this.m_restitution = b2Math.b2Max(this.m_shape1.m_restitution, this.m_shape2.m_restitution);
    this.m_prev = null;
    this.m_next = null;
    this.m_node1.contact = null;
    this.m_node1.prev = null;
    this.m_node1.next = null;
    this.m_node1.other = null;
    this.m_node2.contact = null;
    this.m_node2.prev = null;
    this.m_node2.next = null;
    this.m_node2.other = null;
  }

  // b2Contact.as:77-88
  public static AddType(createFcn: ContactCreateFcn, destroyFcn: ContactDestroyFcn, type1: number, type2: number): void {
    b2Contact.s_registers[type1][type2].createFcn = createFcn;
    b2Contact.s_registers[type1][type2].destroyFcn = destroyFcn;
    b2Contact.s_registers[type1][type2].primary = true;
    if (type1 !== type2) {
      b2Contact.s_registers[type2][type1].createFcn = createFcn;
      b2Contact.s_registers[type2][type1].destroyFcn = destroyFcn;
      b2Contact.s_registers[type2][type1].primary = false;
    }
  }

  // b2Contact.as:90-109 (AddType list driven by the registration table — see _contactFactory)
  public static InitializeRegisters(): void {
    b2Contact.s_registers = new Array(b2Shape.e_shapeTypeCount);
    let i = 0;
    while (i < b2Shape.e_shapeTypeCount) {
      b2Contact.s_registers[i] = new Array(b2Shape.e_shapeTypeCount);
      let j = 0;
      while (j < b2Shape.e_shapeTypeCount) {
        b2Contact.s_registers[i][j] = new b2ContactRegister();
        j++;
      }
      i++;
    }
    for (const reg of getContactTypeRegistrations()) {
      b2Contact.AddType(reg.createFcn, reg.destroyFcn, reg.type1, reg.type2);
    }
  }

  // b2Contact.as:111-142
  public static Create(shape1: b2Shape, shape2: b2Shape, allocator: unknown): b2Contact | null {
    if (b2Contact.s_initialized === false) {
      b2Contact.InitializeRegisters();
      b2Contact.s_initialized = true;
    }
    const type1: number = shape1.m_type;
    const type2: number = shape2.m_type;
    const reg: b2ContactRegister = b2Contact.s_registers[type1][type2];
    const createFcn: ContactCreateFcn | null = reg.createFcn;
    if (createFcn != null) {
      if (reg.primary) {
        return createFcn(shape1, shape2, allocator);
      }
      const c: b2Contact = createFcn(shape2, shape1, allocator);
      let i = 0;
      while (i < c.m_manifoldCount) {
        const m: b2Manifold = c.GetManifolds()![i];
        m.normal = m.normal.Negative();
        i++;
      }
      return c;
    }
    return null;
  }

  // b2Contact.as:144-156
  public static Destroy(contact: b2Contact, allocator: unknown): void {
    if (contact.m_manifoldCount > 0) {
      contact.m_shape1!.m_body!.WakeUp();
      contact.m_shape2!.m_body!.WakeUp();
    }
    const type1: number = contact.m_shape1!.m_type;
    const type2: number = contact.m_shape2!.m_type;
    const reg: b2ContactRegister = b2Contact.s_registers[type1][type2];
    const destroyFcn: ContactDestroyFcn = reg.destroyFcn!;
    destroyFcn(contact, allocator);
  }

  // b2Contact.as:158-186
  public GetManifolds(): b2Manifold[] | null {
    return null;
  }
  public GetManifoldCount(): number {
    return this.m_manifoldCount;
  }
  public IsSolid(): boolean {
    return (this.m_flags & b2Contact.e_nonSolidFlag) === 0;
  }
  public GetNext(): b2Contact | null {
    return this.m_next;
  }
  public GetShape1(): b2Shape | null {
    return this.m_shape1;
  }
  public GetShape2(): b2Shape | null {
    return this.m_shape2;
  }

  // b2Contact.as:188-208
  public Update(listener: b2ContactListener | null): void {
    const oldCount: number = this.m_manifoldCount;
    this.Evaluate(listener);
    const newCount: number = this.m_manifoldCount;
    const body1: b2Body = this.m_shape1!.m_body!;
    const body2: b2Body = this.m_shape2!.m_body!;
    if (newCount === 0 && oldCount > 0) {
      body1.WakeUp();
      body2.WakeUp();
    }
    if (body1.IsStatic() || body1.IsBullet() || body2.IsStatic() || body2.IsBullet()) {
      this.m_flags &= ~b2Contact.e_slowFlag;
    } else {
      this.m_flags |= b2Contact.e_slowFlag;
    }
  }

  // b2Contact.as:210-212 (overridden by subclasses)
  public Evaluate(_listener: b2ContactListener | null): void {}
}
