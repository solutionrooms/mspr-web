// Port of Box2D/Dynamics/b2ContactManager.as (Box2DFlash 2.0.2), line-by-line.
// The broadphase pair callback: PairAdded creates a b2Contact (or m_nullContact when
// the pair must not collide), PairRemoved/Destroy tear it down and fire listener.Remove.
// Collide() re-evaluates every non-sleeping contact each step. Op order preserved.
import { b2PairCallback } from "../Collision/b2PairCallback";
import { b2ContactPoint } from "../Collision/b2ContactPoint";
import type { b2Manifold } from "../Collision/b2Manifold";
import type { b2ManifoldPoint } from "../Collision/b2ManifoldPoint";
import type { b2Vec2 } from "../Common/Math/b2Vec2";
import type { b2Shape } from "../Collision/Shapes/b2Shape";
import { b2Contact } from "./Contacts/b2Contact";
import { b2NullContact } from "./Contacts/b2NullContact";
import type { b2World } from "./b2World";
import type { b2Body } from "./b2Body";
// Side-effect imports: register the concrete contact types with the contact factory so
// b2Contact.Create can dispatch. Order mirrors InitializeRegisters (b2Contact.as:106-108).
import "./Contacts/b2CircleContact";
import "./Contacts/b2PolyAndCircleContact";
import "./Contacts/b2PolygonContact";

export class b2ContactManager extends b2PairCallback {
  private static s_evalCP: b2ContactPoint = new b2ContactPoint();

  public m_world: b2World | null;
  public m_nullContact: b2NullContact = new b2NullContact();
  public m_destroyImmediate: boolean;

  // b2ContactManager.as:20-25
  constructor() {
    super();
    this.m_world = null;
    this.m_destroyImmediate = false;
  }

  // b2ContactManager.as:27-86
  public override PairAdded(proxyUserData1: unknown, proxyUserData2: unknown): unknown {
    let shape1: b2Shape = proxyUserData1 as b2Shape;
    let shape2: b2Shape = proxyUserData2 as b2Shape;
    let body1: b2Body = shape1.m_body!;
    let body2: b2Body = shape2.m_body!;
    if (body1.IsStatic() && body2.IsStatic()) {
      return this.m_nullContact;
    }
    if (shape1.m_body === shape2.m_body) {
      return this.m_nullContact;
    }
    if (body2.IsConnected(body1)) {
      return this.m_nullContact;
    }
    if (this.m_world!.m_contactFilter != null && this.m_world!.m_contactFilter.ShouldCollide(shape1, shape2) === false) {
      return this.m_nullContact;
    }
    const c: b2Contact | null = b2Contact.Create(shape1, shape2, this.m_world!.m_blockAllocator);
    if (c == null) {
      return this.m_nullContact;
    }
    shape1 = c.m_shape1!;
    shape2 = c.m_shape2!;
    body1 = shape1.m_body!;
    body2 = shape2.m_body!;
    c.m_prev = null;
    c.m_next = this.m_world!.m_contactList;
    if (this.m_world!.m_contactList != null) {
      this.m_world!.m_contactList.m_prev = c;
    }
    this.m_world!.m_contactList = c;
    c.m_node1.contact = c;
    c.m_node1.other = body2;
    c.m_node1.prev = null;
    c.m_node1.next = body1.m_contactList;
    if (body1.m_contactList != null) {
      body1.m_contactList.prev = c.m_node1;
    }
    body1.m_contactList = c.m_node1;
    c.m_node2.contact = c;
    c.m_node2.other = body1;
    c.m_node2.prev = null;
    c.m_node2.next = body2.m_contactList;
    if (body2.m_contactList != null) {
      body2.m_contactList.prev = c.m_node2;
    }
    body2.m_contactList = c.m_node2;
    ++this.m_world!.m_contactCount;
    return c;
  }

  // b2ContactManager.as:88-100
  public override PairRemoved(_proxyUserData1: unknown, _proxyUserData2: unknown, pairUserData: unknown): void {
    if (pairUserData == null) {
      return;
    }
    const c: b2Contact = pairUserData as b2Contact;
    if (c === this.m_nullContact) {
      return;
    }
    this.Destroy(c);
  }

  // b2ContactManager.as:102-188
  public Destroy(c: b2Contact): void {
    const shape1: b2Shape = c.m_shape1!;
    const shape2: b2Shape = c.m_shape2!;
    const manifoldCount: number = c.m_manifoldCount;
    if (manifoldCount > 0 && this.m_world!.m_contactListener) {
      const body1: b2Body = shape1.m_body!;
      const body2: b2Body = shape2.m_body!;
      const manifolds: b2Manifold[] = c.GetManifolds()!;
      const cp: b2ContactPoint = b2ContactManager.s_evalCP;
      cp.shape1 = c.m_shape1;
      cp.shape2 = c.m_shape1; // (preserved AS3: both set to shape1 — b2ContactManager.as:123-124)
      cp.friction = c.m_friction;
      cp.restitution = c.m_restitution;
      let i = 0;
      while (i < manifoldCount) {
        const manifold: b2Manifold = manifolds[i];
        cp.normal.SetV(manifold.normal);
        let j = 0;
        while (j < manifold.pointCount) {
          const mp: b2ManifoldPoint = manifold.points[j];
          cp.position = body1.GetWorldPoint(mp.localPoint1);
          const v1: b2Vec2 = body1.GetLinearVelocityFromLocalPoint(mp.localPoint1);
          const v2: b2Vec2 = body2.GetLinearVelocityFromLocalPoint(mp.localPoint2);
          cp.velocity.Set(v2.x - v1.x, v2.y - v1.y);
          cp.separation = mp.separation;
          cp.id.key = mp.id._key;
          this.m_world!.m_contactListener!.Remove(cp);
          j++;
        }
        i++;
      }
    }
    if (c.m_prev) {
      c.m_prev.m_next = c.m_next;
    }
    if (c.m_next) {
      c.m_next.m_prev = c.m_prev;
    }
    if (c === this.m_world!.m_contactList) {
      this.m_world!.m_contactList = c.m_next;
    }
    const body1: b2Body = shape1.m_body!;
    const body2: b2Body = shape2.m_body!;
    if (c.m_node1.prev) {
      c.m_node1.prev.next = c.m_node1.next;
    }
    if (c.m_node1.next) {
      c.m_node1.next.prev = c.m_node1.prev;
    }
    if (c.m_node1 === body1.m_contactList) {
      body1.m_contactList = c.m_node1.next;
    }
    if (c.m_node2.prev) {
      c.m_node2.prev.next = c.m_node2.next;
    }
    if (c.m_node2.next) {
      c.m_node2.next.prev = c.m_node2.prev;
    }
    if (c.m_node2 === body2.m_contactList) {
      body2.m_contactList = c.m_node2.next;
    }
    b2Contact.Destroy(c, this.m_world!.m_blockAllocator);
    --this.m_world!.m_contactCount;
  }

  // b2ContactManager.as:190-205
  public Collide(): void {
    let c: b2Contact | null = this.m_world!.m_contactList;
    while (c) {
      const body1: b2Body = c.m_shape1!.m_body!;
      const body2: b2Body = c.m_shape2!.m_body!;
      if (!(body1.IsSleeping() && body2.IsSleeping())) {
        c.Update(this.m_world!.m_contactListener);
      }
      c = c.m_next;
    }
  }
}
