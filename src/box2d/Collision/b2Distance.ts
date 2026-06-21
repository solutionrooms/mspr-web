// Port of Box2D/Collision/b2Distance.as (Box2DFlash 2.0.2), line-by-line.
// GJK distance between two convex shapes (used by b2TimeOfImpact's conservative
// advancement). Op order preserved exactly. Distances are computed on the TOI-slop-inset
// "core" shapes (GetFirstVertex/Support return core vertices). No trig here.
import { b2Settings } from "../Common/b2Settings";
import { b2Math } from "../Common/Math/b2Math";
import type { b2Mat22 } from "../Common/Math/b2Mat22";
import { b2Vec2 } from "../Common/Math/b2Vec2";
import type { b2XForm } from "../Common/Math/b2XForm";
import { b2Point, type b2SupportShape } from "./b2Point";
import { b2Shape } from "./Shapes/b2Shape";
import type { b2CircleShape } from "./Shapes/b2CircleShape";
import type { b2PolygonShape } from "./Shapes/b2PolygonShape";

export class b2Distance {
  // b2Distance.as:10-18
  private static s_p1s: b2Vec2[] = [new b2Vec2(), new b2Vec2(), new b2Vec2()];
  private static s_p2s: b2Vec2[] = [new b2Vec2(), new b2Vec2(), new b2Vec2()];
  private static s_points: b2Vec2[] = [new b2Vec2(), new b2Vec2(), new b2Vec2()];
  private static gPoint: b2Point = new b2Point();
  public static g_GJK_Iterations: number = 0;

  // b2Distance.as:25-60
  public static ProcessTwo(x1: b2Vec2, x2: b2Vec2, p1s: b2Vec2[], p2s: b2Vec2[], points: b2Vec2[]): number {
    const p1 = points[0];
    const p2 = points[1];
    const p1g = p1s[0];
    const p2g = p1s[1];
    const p1h = p2s[0];
    const p2h = p2s[1];
    const rX: number = -p2.x;
    const rY: number = -p2.y;
    let dX: number = p1.x - p2.x;
    let dY: number = p1.y - p2.y;
    const length: number = Math.sqrt(dX * dX + dY * dY);
    dX /= length;
    dY /= length;
    let lambda: number = rX * dX + rY * dY;
    if (lambda <= 0 || length < Number.MIN_VALUE) {
      x1.SetV(p2g);
      x2.SetV(p2h);
      p1g.SetV(p2g);
      p1h.SetV(p2h);
      p1.SetV(p2);
      return 1;
    }
    lambda /= length;
    x1.x = p2g.x + lambda * (p1g.x - p2g.x);
    x1.y = p2g.y + lambda * (p1g.y - p2g.y);
    x2.x = p2h.x + lambda * (p1h.x - p2h.x);
    x2.y = p2h.y + lambda * (p1h.y - p2h.y);
    return 2;
  }

  // b2Distance.as:62-147
  public static ProcessThree(x1: b2Vec2, x2: b2Vec2, p1s: b2Vec2[], p2s: b2Vec2[], points: b2Vec2[]): number {
    const p1 = points[0];
    const p2 = points[1];
    const p3 = points[2];
    const p1g = p1s[0];
    const p2g = p1s[1];
    const p3g = p1s[2];
    const p1h = p2s[0];
    const p2h = p2s[1];
    const p3h = p2s[2];
    const p1X: number = p1.x;
    const p1Y: number = p1.y;
    const p2X: number = p2.x;
    const p2Y: number = p2.y;
    const p3X: number = p3.x;
    const p3Y: number = p3.y;
    const e12X: number = p2X - p1X;
    const e12Y: number = p2Y - p1Y;
    const e13X: number = p3X - p1X;
    const e13Y: number = p3Y - p1Y;
    const e23X: number = p3X - p2X;
    const e23Y: number = p3Y - p2Y;
    const w1e12: number = -(p1X * e12X + p1Y * e12Y);
    const w2e12: number = p2X * e12X + p2Y * e12Y;
    const w1e13: number = -(p1X * e13X + p1Y * e13Y);
    const w3e13: number = p3X * e13X + p3Y * e13Y;
    const w2e23: number = -(p2X * e23X + p2Y * e23Y);
    const w3e23: number = p3X * e23X + p3Y * e23Y;
    if (w3e13 <= 0 && w3e23 <= 0) {
      x1.SetV(p3g);
      x2.SetV(p3h);
      p1g.SetV(p3g);
      p1h.SetV(p3h);
      p1.SetV(p3);
      return 1;
    }
    const n123: number = e12X * e13Y - e12Y * e13X;
    const d123_1: number = n123 * (p1X * p2Y - p1Y * p2X);
    const d123_2: number = n123 * (p2X * p3Y - p2Y * p3X);
    if (d123_2 <= 0 && w2e23 >= 0 && w3e23 >= 0 && w2e23 + w3e23 > 0) {
      const lambda: number = w2e23 / (w2e23 + w3e23);
      x1.x = p2g.x + lambda * (p3g.x - p2g.x);
      x1.y = p2g.y + lambda * (p3g.y - p2g.y);
      x2.x = p2h.x + lambda * (p3h.x - p2h.x);
      x2.y = p2h.y + lambda * (p3h.y - p2h.y);
      p1g.SetV(p3g);
      p1h.SetV(p3h);
      p1.SetV(p3);
      return 2;
    }
    const d123_3: number = n123 * (p3X * p1Y - p3Y * p1X);
    if (d123_3 <= 0 && w1e13 >= 0 && w3e13 >= 0 && w1e13 + w3e13 > 0) {
      const lambda: number = w1e13 / (w1e13 + w3e13);
      x1.x = p1g.x + lambda * (p3g.x - p1g.x);
      x1.y = p1g.y + lambda * (p3g.y - p1g.y);
      x2.x = p1h.x + lambda * (p3h.x - p1h.x);
      x2.y = p1h.y + lambda * (p3h.y - p1h.y);
      p2g.SetV(p3g);
      p2h.SetV(p3h);
      p2.SetV(p3);
      return 2;
    }
    let inv_d123: number = d123_2 + d123_3 + d123_1;
    inv_d123 = 1 / inv_d123;
    const lambda1: number = d123_2 * inv_d123;
    const lambda2: number = d123_3 * inv_d123;
    const lambda3: number = 1 - lambda1 - lambda2;
    x1.x = lambda1 * p1g.x + lambda2 * p2g.x + lambda3 * p3g.x;
    x1.y = lambda1 * p1g.y + lambda2 * p2g.y + lambda3 * p3g.y;
    x2.x = lambda1 * p1h.x + lambda2 * p2h.x + lambda3 * p3h.x;
    x2.y = lambda1 * p1h.y + lambda2 * p2h.y + lambda3 * p3h.y;
    return 3;
  }

  // b2Distance.as:149-172
  public static InPoints(w: b2Vec2, points: b2Vec2[], pointCount: number): boolean {
    const k_tolerance: number = 100 * Number.MIN_VALUE;
    let i = 0;
    while (i < pointCount) {
      const point: b2Vec2 = points[i];
      const dX: number = Math.abs(w.x - point.x);
      const dY: number = Math.abs(w.y - point.y);
      const wX: number = Math.max(Math.abs(w.x), Math.abs(point.x));
      const wY: number = Math.max(Math.abs(w.y), Math.abs(point.y));
      if (dX < k_tolerance * (wX + 1) && dY < k_tolerance * (wY + 1)) {
        return true;
      }
      i++;
    }
    return false;
  }

  // b2Distance.as:174-274
  public static DistanceGeneric(
    x1: b2Vec2,
    x2: b2Vec2,
    shape1: b2SupportShape,
    xf1: b2XForm,
    shape2: b2SupportShape,
    xf2: b2XForm,
  ): number {
    const p1s: b2Vec2[] = b2Distance.s_p1s;
    const p2s: b2Vec2[] = b2Distance.s_p2s;
    const points: b2Vec2[] = b2Distance.s_points;
    let pointCount: number = 0;
    x1.SetV(shape1.GetFirstVertex(xf1));
    x2.SetV(shape2.GetFirstVertex(xf2));
    let vSqr: number = 0;
    const maxIterations: number = 20;
    let iter = 0;
    while (iter < maxIterations) {
      const dX: number = x2.x - x1.x;
      const dY: number = x2.y - x1.y;
      const w1: b2Vec2 = shape1.Support(xf1, dX, dY);
      const w2: b2Vec2 = shape2.Support(xf2, -dX, -dY);
      vSqr = dX * dX + dY * dY;
      const wX: number = w2.x - w1.x;
      const wY: number = w2.y - w1.y;
      const vw: number = dX * wX + dY * wY;
      if (vSqr - (dX * wX + dY * wY) <= 0.01 * vSqr) {
        if (pointCount === 0) {
          x1.SetV(w1);
          x2.SetV(w2);
        }
        b2Distance.g_GJK_Iterations = iter;
        return Math.sqrt(vSqr);
      }
      let tmp: b2Vec2;
      switch (pointCount) {
        case 0:
          tmp = p1s[0];
          tmp.SetV(w1);
          tmp = p2s[0];
          tmp.SetV(w2);
          tmp = points[0];
          tmp.x = wX;
          tmp.y = wY;
          x1.SetV(p1s[0]);
          x2.SetV(p2s[0]);
          pointCount++;
          break;
        case 1:
          tmp = p1s[1];
          tmp.SetV(w1);
          tmp = p2s[1];
          tmp.SetV(w2);
          tmp = points[1];
          tmp.x = wX;
          tmp.y = wY;
          pointCount = b2Distance.ProcessTwo(x1, x2, p1s, p2s, points);
          break;
        case 2:
          tmp = p1s[2];
          tmp.SetV(w1);
          tmp = p2s[2];
          tmp.SetV(w2);
          tmp = points[2];
          tmp.x = wX;
          tmp.y = wY;
          pointCount = b2Distance.ProcessThree(x1, x2, p1s, p2s, points);
          break;
      }
      if (pointCount === 3) {
        b2Distance.g_GJK_Iterations = iter;
        return 0;
      }
      let maxSqr: number = -Number.MAX_VALUE;
      let i = 0;
      while (i < pointCount) {
        const point: b2Vec2 = points[i];
        maxSqr = b2Math.b2Max(maxSqr, point.x * point.x + point.y * point.y);
        i++;
      }
      if (pointCount === 3 || vSqr <= 100 * Number.MIN_VALUE * maxSqr) {
        b2Distance.g_GJK_Iterations = iter;
        const dX2: number = x2.x - x1.x;
        const dY2: number = x2.y - x1.y;
        vSqr = dX2 * dX2 + dY2 * dY2;
        return Math.sqrt(vSqr);
      }
      iter++;
    }
    b2Distance.g_GJK_Iterations = maxIterations;
    return Math.sqrt(vSqr);
  }

  // b2Distance.as:276-324
  public static DistanceCC(
    x1: b2Vec2,
    x2: b2Vec2,
    circle1: b2CircleShape,
    xf1: b2XForm,
    circle2: b2CircleShape,
    xf2: b2XForm,
  ): number {
    let tMat: b2Mat22 = xf1.R;
    let tVec: b2Vec2 = circle1.m_localPosition;
    const p1X: number = xf1.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    const p1Y: number = xf1.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
    tMat = xf2.R;
    tVec = circle2.m_localPosition;
    const p2X: number = xf2.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    const p2Y: number = xf2.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
    let dX: number = p2X - p1X;
    let dY: number = p2Y - p1Y;
    const distSqr: number = dX * dX + dY * dY;
    const r1: number = circle1.m_radius - b2Settings.b2_toiSlop;
    const r2: number = circle2.m_radius - b2Settings.b2_toiSlop;
    const r: number = r1 + r2;
    if (distSqr > r * r) {
      const dist: number = Math.sqrt(dX * dX + dY * dY);
      dX /= dist;
      dY /= dist;
      const separation: number = dist - r;
      x1.x = p1X + r1 * dX;
      x1.y = p1Y + r1 * dY;
      x2.x = p2X - r2 * dX;
      x2.y = p2Y - r2 * dY;
      return separation;
    }
    if (distSqr > Number.MIN_VALUE * Number.MIN_VALUE) {
      const dist: number = Math.sqrt(dX * dX + dY * dY);
      dX /= dist;
      dY /= dist;
      x1.x = p1X + r1 * dX;
      x1.y = p1Y + r1 * dY;
      x2.x = x1.x;
      x2.y = x1.y;
      return 0;
    }
    x1.x = p1X;
    x1.y = p1Y;
    x2.x = x1.x;
    x2.y = x1.y;
    return 0;
  }

  // b2Distance.as:326-358
  public static DistancePC(
    x1: b2Vec2,
    x2: b2Vec2,
    polygon: b2PolygonShape,
    xf1: b2XForm,
    circle: b2CircleShape,
    xf2: b2XForm,
  ): number {
    const point: b2Point = b2Distance.gPoint;
    const tVec: b2Vec2 = circle.m_localPosition;
    const tMat: b2Mat22 = xf2.R;
    point.p.x = xf2.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    point.p.y = xf2.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
    let distance: number = b2Distance.DistanceGeneric(x1, x2, polygon, xf1, point, b2Math.b2XForm_identity);
    const r: number = circle.m_radius - b2Settings.b2_toiSlop;
    if (distance > r) {
      distance -= r;
      let dX: number = x2.x - x1.x;
      let dY: number = x2.y - x1.y;
      const length: number = Math.sqrt(dX * dX + dY * dY);
      dX /= length;
      dY /= length;
      x2.x -= r * dX;
      x2.y -= r * dY;
    } else {
      distance = 0;
      x2.x = x1.x;
      x2.y = x1.y;
    }
    return distance;
  }

  // b2Distance.as:360-381
  public static Distance(x1: b2Vec2, x2: b2Vec2, shape1: b2Shape, xf1: b2XForm, shape2: b2Shape, xf2: b2XForm): number {
    const type1: number = shape1.m_type;
    const type2: number = shape2.m_type;
    if (type1 === b2Shape.e_circleShape && type2 === b2Shape.e_circleShape) {
      return b2Distance.DistanceCC(x1, x2, shape1 as unknown as b2CircleShape, xf1, shape2 as unknown as b2CircleShape, xf2);
    }
    if (type1 === b2Shape.e_polygonShape && type2 === b2Shape.e_circleShape) {
      return b2Distance.DistancePC(x1, x2, shape1 as unknown as b2PolygonShape, xf1, shape2 as unknown as b2CircleShape, xf2);
    }
    if (type1 === b2Shape.e_circleShape && type2 === b2Shape.e_polygonShape) {
      return b2Distance.DistancePC(x2, x1, shape2 as unknown as b2PolygonShape, xf2, shape1 as unknown as b2CircleShape, xf1);
    }
    if (type1 === b2Shape.e_polygonShape && type2 === b2Shape.e_polygonShape) {
      return b2Distance.DistanceGeneric(
        x1,
        x2,
        shape1 as unknown as b2PolygonShape,
        xf1,
        shape2 as unknown as b2PolygonShape,
        xf2,
      );
    }
    return 0;
  }
}
