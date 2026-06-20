// Port of Box2D/Collision/Shapes/b2CircleShape.as (Box2DFlash 2.0.2), line-by-line.
// Op order preserved. ComputeMass uses b2_pi (no trig); bit-exact-able.
import { b2Shape } from "./b2Shape";
import { b2CircleDef } from "./b2CircleDef";
import type { b2ShapeDef } from "./b2ShapeDef";
import type { b2MassData } from "./b2MassData";
import { b2Settings } from "../../Common/b2Settings";
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import type { b2Mat22 } from "../../Common/Math/b2Mat22";
import type { b2XForm } from "../../Common/Math/b2XForm";
import type { b2AABB } from "../b2AABB";
import type { b2Segment } from "../b2Segment";
import { registerShapeCtor } from "./_shapeFactory";

export class b2CircleShape extends b2Shape {
  public m_localPosition: b2Vec2 = new b2Vec2();
  public m_radius!: number;

  // b2CircleShape.as:15-22
  constructor(def: b2ShapeDef) {
    super(def);
    const circleDef: b2CircleDef = def as b2CircleDef;
    this.m_type = b2Shape.e_circleShape;
    this.m_localPosition.SetV(circleDef.localPosition);
    this.m_radius = circleDef.radius;
  }

  // b2CircleShape.as:24-32
  public override TestPoint(transform: b2XForm, p: b2Vec2): boolean {
    const tMat: b2Mat22 = transform.R;
    let dX: number = transform.position.x + (tMat.col1.x * this.m_localPosition.x + tMat.col2.x * this.m_localPosition.y);
    let dY: number = transform.position.y + (tMat.col1.y * this.m_localPosition.x + tMat.col2.y * this.m_localPosition.y);
    dX = p.x - dX;
    dY = p.y - dY;
    return dX * dX + dY * dY <= this.m_radius * this.m_radius;
  }

  // b2CircleShape.as:34-68
  public override TestSegment(
    transform: b2XForm,
    lambda: number[],
    normal: b2Vec2,
    segment: b2Segment,
    maxLambda: number,
  ): number {
    const tMat: b2Mat22 = transform.R;
    const positionX: number =
      transform.position.x + (tMat.col1.x * this.m_localPosition.x + tMat.col2.x * this.m_localPosition.y);
    const positionY: number =
      transform.position.y + (tMat.col1.y * this.m_localPosition.x + tMat.col2.y * this.m_localPosition.y);
    const sX: number = segment.p1.x - positionX;
    const sY: number = segment.p1.y - positionY;
    const b: number = sX * sX + sY * sY - this.m_radius * this.m_radius;
    if (b < 0) {
      lambda[0] = 0;
      return b2Shape.e_startsInsideCollide;
    }
    const rX: number = segment.p2.x - segment.p1.x;
    const rY: number = segment.p2.y - segment.p1.y;
    const c: number = sX * rX + sY * rY;
    const rr: number = rX * rX + rY * rY;
    const sigma: number = c * c - rr * b;
    if (sigma < 0 || rr < Number.MIN_VALUE) {
      return b2Shape.e_missCollide;
    }
    let a: number = -(c + Math.sqrt(sigma));
    if (0 <= a && a <= maxLambda * rr) {
      a /= rr;
      lambda[0] = a;
      normal.x = sX + a * rX;
      normal.y = sY + a * rY;
      normal.Normalize();
      return b2Shape.e_hitCollide;
    }
    return b2Shape.e_missCollide;
  }

  // b2CircleShape.as:70-77
  public override ComputeAABB(aabb: b2AABB, transform: b2XForm): void {
    const tMat: b2Mat22 = transform.R;
    const pX: number = transform.position.x + (tMat.col1.x * this.m_localPosition.x + tMat.col2.x * this.m_localPosition.y);
    const pY: number = transform.position.y + (tMat.col1.y * this.m_localPosition.x + tMat.col2.y * this.m_localPosition.y);
    aabb.lowerBound.Set(pX - this.m_radius, pY - this.m_radius);
    aabb.upperBound.Set(pX + this.m_radius, pY + this.m_radius);
  }

  // b2CircleShape.as:79-90
  public override ComputeSweptAABB(aabb: b2AABB, transform1: b2XForm, transform2: b2XForm): void {
    let tMat: b2Mat22 = transform1.R;
    const p1X: number = transform1.position.x + (tMat.col1.x * this.m_localPosition.x + tMat.col2.x * this.m_localPosition.y);
    const p1Y: number = transform1.position.y + (tMat.col1.y * this.m_localPosition.x + tMat.col2.y * this.m_localPosition.y);
    tMat = transform2.R;
    const p2X: number = transform2.position.x + (tMat.col1.x * this.m_localPosition.x + tMat.col2.x * this.m_localPosition.y);
    const p2Y: number = transform2.position.y + (tMat.col1.y * this.m_localPosition.x + tMat.col2.y * this.m_localPosition.y);
    aabb.lowerBound.Set((p1X < p2X ? p1X : p2X) - this.m_radius, (p1Y < p2Y ? p1Y : p2Y) - this.m_radius);
    aabb.upperBound.Set((p1X > p2X ? p1X : p2X) + this.m_radius, (p1Y > p2Y ? p1Y : p2Y) + this.m_radius);
  }

  // b2CircleShape.as:92-97
  public override ComputeMass(massData: b2MassData): void {
    massData.mass = this.m_density * b2Settings.b2_pi * this.m_radius * this.m_radius;
    massData.center.SetV(this.m_localPosition);
    massData.I =
      massData.mass *
      (0.5 * this.m_radius * this.m_radius +
        (this.m_localPosition.x * this.m_localPosition.x + this.m_localPosition.y * this.m_localPosition.y));
  }

  // b2CircleShape.as:99-107
  public GetLocalPosition(): b2Vec2 {
    return this.m_localPosition;
  }
  public GetRadius(): number {
    return this.m_radius;
  }

  // b2CircleShape.as:109-115
  public override UpdateSweepRadius(center: b2Vec2): void {
    const dX: number = this.m_localPosition.x - center.x;
    const dY: number = this.m_localPosition.y - center.y;
    const d: number = Math.sqrt(dX * dX + dY * dY);
    this.m_sweepRadius = d + this.m_radius - b2Settings.b2_toiSlop;
  }
}

// Register with the factory so b2Shape.Create(def) dispatches to us (see _shapeFactory).
registerShapeCtor(b2Shape.e_circleShape, (def: b2ShapeDef) => new b2CircleShape(def));
