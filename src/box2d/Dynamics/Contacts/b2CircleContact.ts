// Port of Box2D/Dynamics/Contacts/b2CircleContact.as (Box2DFlash 2.0.2), line-by-line.
// Evaluate: snapshot old manifold (m0), recompute via b2CollideCircles, then warm-start
// the impulses by id match (single point) and fire Add/Persist/Remove on the listener.
import { b2Contact } from "./b2Contact";
import { b2Collision } from "../../Collision/b2Collision";
import { b2Manifold } from "../../Collision/b2Manifold";
import { b2ContactPoint } from "../../Collision/b2ContactPoint";
import type { b2ManifoldPoint } from "../../Collision/b2ManifoldPoint";
import type { b2Vec2 } from "../../Common/Math/b2Vec2";
import { b2Shape } from "../../Collision/Shapes/b2Shape";
import type { b2CircleShape } from "../../Collision/Shapes/b2CircleShape";
import type { b2Body } from "../b2Body";
import type { b2ContactListener } from "../b2ContactListener";
import { registerContactType } from "./_contactFactory";

export class b2CircleContact extends b2Contact {
  private static s_evalCP: b2ContactPoint = new b2ContactPoint();

  private m_manifolds: b2Manifold[] = [new b2Manifold()];
  public m_manifold: b2Manifold;
  private m0: b2Manifold = new b2Manifold();

  // b2CircleContact.as:18-26
  constructor(shape1: b2Shape, shape2: b2Shape) {
    super(shape1, shape2);
    this.m_manifold = this.m_manifolds[0];
    this.m_manifold.pointCount = 0;
    const mp: b2ManifoldPoint = this.m_manifold.points[0];
    mp.normalImpulse = 0;
    mp.tangentImpulse = 0;
  }

  // b2CircleContact.as:28-31
  public static Create(shape1: b2Shape, shape2: b2Shape, _allocator: unknown): b2Contact {
    return new b2CircleContact(shape1, shape2);
  }
  // b2CircleContact.as:33-35
  public static Destroy(_contact: b2Contact, _allocator: unknown): void {}

  // b2CircleContact.as:37-110
  public override Evaluate(listener: b2ContactListener | null): void {
    const body1: b2Body = this.m_shape1!.m_body!;
    const body2: b2Body = this.m_shape2!.m_body!;
    this.m0.Set(this.m_manifold);
    b2Collision.b2CollideCircles(
      this.m_manifold,
      this.m_shape1 as unknown as b2CircleShape,
      body1.m_xf,
      this.m_shape2 as unknown as b2CircleShape,
      body2.m_xf,
    );
    const cp: b2ContactPoint = b2CircleContact.s_evalCP;
    cp.shape1 = this.m_shape1;
    cp.shape2 = this.m_shape2;
    cp.friction = this.m_friction;
    cp.restitution = this.m_restitution;
    let v1: b2Vec2;
    let v2: b2Vec2;
    if (this.m_manifold.pointCount > 0) {
      this.m_manifoldCount = 1;
      const mp: b2ManifoldPoint = this.m_manifold.points[0];
      if (this.m0.pointCount === 0) {
        mp.normalImpulse = 0;
        mp.tangentImpulse = 0;
        if (listener) {
          cp.position = body1.GetWorldPoint(mp.localPoint1);
          v1 = body1.GetLinearVelocityFromLocalPoint(mp.localPoint1);
          v2 = body2.GetLinearVelocityFromLocalPoint(mp.localPoint2);
          cp.velocity.Set(v2.x - v1.x, v2.y - v1.y);
          cp.normal.SetV(this.m_manifold.normal);
          cp.separation = mp.separation;
          cp.id.key = mp.id._key;
          listener.Add(cp);
        }
      } else {
        const mp0: b2ManifoldPoint = this.m0.points[0];
        mp.normalImpulse = mp0.normalImpulse;
        mp.tangentImpulse = mp0.tangentImpulse;
        if (listener) {
          cp.position = body1.GetWorldPoint(mp.localPoint1);
          v1 = body1.GetLinearVelocityFromLocalPoint(mp.localPoint1);
          v2 = body2.GetLinearVelocityFromLocalPoint(mp.localPoint2);
          cp.velocity.Set(v2.x - v1.x, v2.y - v1.y);
          cp.normal.SetV(this.m_manifold.normal);
          cp.separation = mp.separation;
          cp.id.key = mp.id._key;
          listener.Persist(cp);
        }
      }
    } else {
      this.m_manifoldCount = 0;
      if (this.m0.pointCount > 0 && listener) {
        const mp0: b2ManifoldPoint = this.m0.points[0];
        cp.position = body1.GetWorldPoint(mp0.localPoint1);
        v1 = body1.GetLinearVelocityFromLocalPoint(mp0.localPoint1);
        v2 = body2.GetLinearVelocityFromLocalPoint(mp0.localPoint2);
        cp.velocity.Set(v2.x - v1.x, v2.y - v1.y);
        cp.normal.SetV(this.m0.normal);
        cp.separation = mp0.separation;
        cp.id.key = mp0.id._key;
        listener.Remove(cp);
      }
    }
  }

  // b2CircleContact.as:112-115
  public override GetManifolds(): b2Manifold[] {
    return this.m_manifolds;
  }
}

// Register so b2Contact.Create dispatches circle-circle here (see _contactFactory).
registerContactType({
  type1: b2Shape.e_circleShape,
  type2: b2Shape.e_circleShape,
  createFcn: b2CircleContact.Create,
  destroyFcn: b2CircleContact.Destroy,
});
