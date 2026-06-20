// Port of Box2D/Collision/b2Segment.as (Box2DFlash 2.0.2), line-by-line.
// (The decompiled `greaterthan0` inner functions are dead — defined, never called —
//  so they are omitted; behaviour is identical.)
import { b2Vec2 } from "../Common/Math/b2Vec2";
import type { b2AABB } from "./b2AABB";

export class b2Segment {
  public p1: b2Vec2 = new b2Vec2();
  public p2: b2Vec2 = new b2Vec2();

  // b2Segment.as:16-58
  public TestSegment(lambda: number[], normal: b2Vec2, segment: b2Segment, maxLambda: number): boolean {
    const s: b2Vec2 = segment.p1;
    const rX: number = segment.p2.x - s.x;
    const rY: number = segment.p2.y - s.y;
    const dX: number = this.p2.x - this.p1.x;
    let dY: number;
    const nX: number = (dY = this.p2.y - this.p1.y);
    const nY: number = -dX;
    const k_slop: number = 100 * Number.MIN_VALUE;
    const denom: number = -(rX * nX + rY * nY);
    if (denom > k_slop) {
      const bX: number = s.x - this.p1.x;
      const bY: number = s.y - this.p1.y;
      let a: number = bX * nX + bY * nY;
      if (0 <= a && a <= maxLambda * denom) {
        const mu2: number = -rY * bY + rY * bX;
        if (-k_slop * denom <= mu2 && mu2 <= denom * (1 + k_slop)) {
          a /= denom;
          const lenN: number = Math.sqrt(nX * nX + nY * nY);
          const n2X: number = nX / lenN;
          const n2Y: number = nY / lenN;
          lambda[0] = a;
          normal.Set(n2X, n2Y);
          return true;
        }
      }
    }
    return false;
  }

  // b2Segment.as:60-64
  public Extend(aabb: b2AABB): void {
    this.ExtendForward(aabb);
    this.ExtendBackward(aabb);
  }

  // b2Segment.as:66-77
  public ExtendForward(aabb: b2AABB): void {
    const dX: number = this.p2.x - this.p1.x;
    const dY: number = this.p2.y - this.p1.y;
    const lambda: number = Math.min(
      dX > 0
        ? (aabb.upperBound.x - this.p1.x) / dX
        : dX < 0
          ? (aabb.lowerBound.x - this.p1.x) / dX
          : Number.POSITIVE_INFINITY,
      dY > 0
        ? (aabb.upperBound.y - this.p1.y) / dY
        : dY < 0
          ? (aabb.lowerBound.y - this.p1.y) / dY
          : Number.POSITIVE_INFINITY,
    );
    this.p2.x = this.p1.x + dX * lambda;
    this.p2.y = this.p1.y + dY * lambda;
  }

  // b2Segment.as:79-92
  public ExtendBackward(aabb: b2AABB): void {
    const dX: number = -this.p2.x + this.p1.x;
    const dY: number = -this.p2.y + this.p1.y;
    const lambda: number = Math.min(
      dX > 0
        ? (aabb.upperBound.x - this.p2.x) / dX
        : dX < 0
          ? (aabb.lowerBound.x - this.p2.x) / dX
          : Number.POSITIVE_INFINITY,
      dY > 0
        ? (aabb.upperBound.y - this.p2.y) / dY
        : dY < 0
          ? (aabb.lowerBound.y - this.p2.y) / dY
          : Number.POSITIVE_INFINITY,
    );
    this.p1.x = this.p2.x + dX * lambda;
    this.p1.y = this.p2.y + dY * lambda;
  }
}
