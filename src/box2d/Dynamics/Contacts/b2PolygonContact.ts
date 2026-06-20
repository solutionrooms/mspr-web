// Port of Box2D/Dynamics/Contacts/b2PolygonContact.as (Box2DFlash 2.0.2), line-by-line.
// Multi-point warm-start: for each new manifold point, match an old point by id._key to
// carry its impulses (Persist) else Add; old points with no match are Removed.
import { b2Contact } from "./b2Contact";
import { b2Collision } from "../../Collision/b2Collision";
import { b2Manifold } from "../../Collision/b2Manifold";
import { b2ContactPoint } from "../../Collision/b2ContactPoint";
import type { b2ManifoldPoint } from "../../Collision/b2ManifoldPoint";
import type { b2Vec2 } from "../../Common/Math/b2Vec2";
import { b2Shape } from "../../Collision/Shapes/b2Shape";
import type { b2PolygonShape } from "../../Collision/Shapes/b2PolygonShape";
import type { b2Body } from "../b2Body";
import type { b2ContactListener } from "../b2ContactListener";
import { registerContactType } from "./_contactFactory";

export class b2PolygonContact extends b2Contact {
  private static s_evalCP: b2ContactPoint = new b2ContactPoint();

  private m0: b2Manifold = new b2Manifold();
  private m_manifolds: b2Manifold[] = [new b2Manifold()];
  public m_manifold: b2Manifold;

  // b2PolygonContact.as:18-23
  constructor(shape1: b2Shape, shape2: b2Shape) {
    super(shape1, shape2);
    this.m_manifold = this.m_manifolds[0];
    this.m_manifold.pointCount = 0;
  }

  // b2PolygonContact.as:25-28
  public static Create(shape1: b2Shape, shape2: b2Shape, _allocator: unknown): b2Contact {
    return new b2PolygonContact(shape1, shape2);
  }
  public static Destroy(_contact: b2Contact, _allocator: unknown): void {}

  // b2PolygonContact.as:34-149
  public override Evaluate(listener: b2ContactListener | null): void {
    const body1: b2Body = this.m_shape1!.m_body!;
    const body2: b2Body = this.m_shape2!.m_body!;
    this.m0.Set(this.m_manifold);
    b2Collision.b2CollidePolygons(
      this.m_manifold,
      this.m_shape1 as unknown as b2PolygonShape,
      body1.m_xf,
      this.m_shape2 as unknown as b2PolygonShape,
      body2.m_xf,
    );
    const match: boolean[] = [false, false];
    const cp: b2ContactPoint = b2PolygonContact.s_evalCP;
    cp.shape1 = this.m_shape1;
    cp.shape2 = this.m_shape2;
    cp.friction = this.m_friction;
    cp.restitution = this.m_restitution;
    let v1: b2Vec2;
    let v2: b2Vec2;
    if (this.m_manifold.pointCount > 0) {
      let i = 0;
      while (i < this.m_manifold.pointCount) {
        const mp: b2ManifoldPoint = this.m_manifold.points[i];
        mp.normalImpulse = 0;
        mp.tangentImpulse = 0;
        let found: boolean = false;
        const idKey: number = mp.id._key;
        let j = 0;
        while (j < this.m0.pointCount) {
          if (match[j] !== true) {
            const mp0: b2ManifoldPoint = this.m0.points[j];
            if (mp0.id._key === idKey) {
              match[j] = true;
              mp.normalImpulse = mp0.normalImpulse;
              mp.tangentImpulse = mp0.tangentImpulse;
              found = true;
              if (listener != null) {
                cp.position = body1.GetWorldPoint(mp.localPoint1);
                v1 = body1.GetLinearVelocityFromLocalPoint(mp.localPoint1);
                v2 = body2.GetLinearVelocityFromLocalPoint(mp.localPoint2);
                cp.velocity.Set(v2.x - v1.x, v2.y - v1.y);
                cp.normal.SetV(this.m_manifold.normal);
                cp.separation = mp.separation;
                cp.id.key = idKey;
                listener.Persist(cp);
              }
              break;
            }
          }
          j++;
        }
        if (found === false && listener != null) {
          cp.position = body1.GetWorldPoint(mp.localPoint1);
          v1 = body1.GetLinearVelocityFromLocalPoint(mp.localPoint1);
          v2 = body2.GetLinearVelocityFromLocalPoint(mp.localPoint2);
          cp.velocity.Set(v2.x - v1.x, v2.y - v1.y);
          cp.normal.SetV(this.m_manifold.normal);
          cp.separation = mp.separation;
          cp.id.key = idKey;
          listener.Add(cp);
        }
        i++;
      }
      this.m_manifoldCount = 1;
    } else {
      this.m_manifoldCount = 0;
    }
    if (listener == null) {
      return;
    }
    let i = 0;
    while (i < this.m0.pointCount) {
      if (!match[i]) {
        const mp0: b2ManifoldPoint = this.m0.points[i];
        cp.position = body1.GetWorldPoint(mp0.localPoint1);
        v1 = body1.GetLinearVelocityFromLocalPoint(mp0.localPoint1);
        v2 = body2.GetLinearVelocityFromLocalPoint(mp0.localPoint2);
        cp.velocity.Set(v2.x - v1.x, v2.y - v1.y);
        cp.normal.SetV(this.m0.normal);
        cp.separation = mp0.separation;
        cp.id.key = mp0.id._key;
        listener.Remove(cp);
      }
      i++;
    }
  }

  // b2PolygonContact.as:151-154
  public override GetManifolds(): b2Manifold[] {
    return this.m_manifolds;
  }
}

registerContactType({
  type1: b2Shape.e_polygonShape,
  type2: b2Shape.e_polygonShape,
  createFcn: b2PolygonContact.Create,
  destroyFcn: b2PolygonContact.Destroy,
});
