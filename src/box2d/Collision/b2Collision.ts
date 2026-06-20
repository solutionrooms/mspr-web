// Port of Box2D/Collision/b2Collision.as (Box2DFlash 2.0.2), line-by-line.
// Narrowphase: circle-circle, polygon-circle, polygon-polygon (SAT + Sutherland-
// Hodgman clip). Op order preserved exactly. NOTE the reference (not copy) aliasing
// of ClipVertex.id in ClipSegmentToLine — preserved verbatim, it matters downstream.
import { b2Settings } from "../Common/b2Settings";
import { b2Math } from "../Common/Math/b2Math";
import type { b2Mat22 } from "../Common/Math/b2Mat22";
import { b2Vec2 } from "../Common/Math/b2Vec2";
import { b2XForm } from "../Common/Math/b2XForm";
import type { b2AABB } from "./b2AABB";
import { ClipVertex } from "./ClipVertex";
import type { b2Manifold } from "./b2Manifold";
import type { b2ManifoldPoint } from "./b2ManifoldPoint";
import type { b2PolygonShape } from "./Shapes/b2PolygonShape";
import type { b2CircleShape } from "./Shapes/b2CircleShape";

export class b2Collision {
  // b2Collision.as:10
  public static readonly b2_nullFeature: number = 255;
  // b2Collision.as:12
  private static b2CollidePolyTempVec: b2Vec2 = new b2Vec2();

  // b2Collision.as:19-66
  public static ClipSegmentToLine(vOut: ClipVertex[], vIn: ClipVertex[], normal: b2Vec2, offset: number): number {
    let numOut: number = 0;
    let cv: ClipVertex = vIn[0];
    const vIn0: b2Vec2 = cv.v;
    cv = vIn[1];
    const vIn1: b2Vec2 = cv.v;
    const distance0: number = b2Math.b2Dot(normal, vIn0) - offset;
    const distance1: number = b2Math.b2Dot(normal, vIn1) - offset;
    if (distance0 <= 0) {
      vOut[numOut++] = vIn[0];
    }
    if (distance1 <= 0) {
      vOut[numOut++] = vIn[1];
    }
    if (distance0 * distance1 < 0) {
      const interp: number = distance0 / (distance0 - distance1);
      cv = vOut[numOut];
      const v: b2Vec2 = cv.v;
      v.x = vIn0.x + interp * (vIn1.x - vIn0.x);
      v.y = vIn0.y + interp * (vIn1.y - vIn0.y);
      cv = vOut[numOut];
      let cv2: ClipVertex;
      if (distance0 > 0) {
        cv2 = vIn[0];
        cv.id = cv2.id;
      } else {
        cv2 = vIn[1];
        cv.id = cv2.id;
      }
      numOut++;
    }
    return numOut;
  }

  // b2Collision.as:68-110
  public static EdgeSeparation(
    poly1: b2PolygonShape,
    xf1: b2XForm,
    edge1: number,
    poly2: b2PolygonShape,
    xf2: b2XForm,
  ): number {
    const count1: number = poly1.m_vertexCount;
    const vertices1: b2Vec2[] = poly1.m_vertices;
    const normals1: b2Vec2[] = poly1.m_normals;
    const count2: number = poly2.m_vertexCount;
    const vertices2: b2Vec2[] = poly2.m_vertices;
    let tMat: b2Mat22 = xf1.R;
    let tVec: b2Vec2 = normals1[edge1];
    let normal1WorldX: number = tMat.col1.x * tVec.x + tMat.col2.x * tVec.y;
    let normal1WorldY: number = tMat.col1.y * tVec.x + tMat.col2.y * tVec.y;
    tMat = xf2.R;
    const normal1X: number = tMat.col1.x * normal1WorldX + tMat.col1.y * normal1WorldY;
    const normal1Y: number = tMat.col2.x * normal1WorldX + tMat.col2.y * normal1WorldY;
    let index: number = 0;
    let minDot: number = Number.MAX_VALUE;
    let i: number = 0;
    while (i < count2) {
      tVec = vertices2[i];
      const dot: number = tVec.x * normal1X + tVec.y * normal1Y;
      if (dot < minDot) {
        minDot = dot;
        index = i;
      }
      i++;
    }
    tVec = vertices1[edge1];
    tMat = xf1.R;
    const v1X: number = xf1.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    const v1Y: number = xf1.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
    tVec = vertices2[index];
    tMat = xf2.R;
    let v2X: number = xf2.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    let v2Y: number = xf2.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
    v2X -= v1X;
    v2Y -= v1Y;
    return v2X * normal1WorldX + v2Y * normal1WorldY;
  }

  // b2Collision.as:112-204
  public static FindMaxSeparation(
    edgeIndexOut: number[],
    poly1: b2PolygonShape,
    xf1: b2XForm,
    poly2: b2PolygonShape,
    xf2: b2XForm,
  ): number {
    const count1: number = poly1.m_vertexCount;
    const normals1: b2Vec2[] = poly1.m_normals;
    let tMat: b2Mat22 = xf2.R;
    let tVec: b2Vec2 = poly2.m_centroid;
    let dX: number = xf2.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    let dY: number = xf2.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
    tMat = xf1.R;
    tVec = poly1.m_centroid;
    dX -= xf1.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    dY -= xf1.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
    const dLocal1X: number = dX * xf1.R.col1.x + dY * xf1.R.col1.y;
    const dLocal1Y: number = dX * xf1.R.col2.x + dY * xf1.R.col2.y;
    let edge: number = 0;
    let maxDot: number = -Number.MAX_VALUE;
    let i: number = 0;
    while (i < count1) {
      tVec = normals1[i];
      const dot: number = tVec.x * dLocal1X + tVec.y * dLocal1Y;
      if (dot > maxDot) {
        maxDot = dot;
        edge = i;
      }
      i++;
    }
    let s: number = b2Collision.EdgeSeparation(poly1, xf1, edge, poly2, xf2);
    if (s > 0) {
      return s;
    }
    const prevEdge: number = edge - 1 >= 0 ? edge - 1 : count1 - 1;
    const sPrev: number = b2Collision.EdgeSeparation(poly1, xf1, prevEdge, poly2, xf2);
    if (sPrev > 0) {
      return sPrev;
    }
    const nextEdge: number = edge + 1 < count1 ? edge + 1 : 0;
    const sNext: number = b2Collision.EdgeSeparation(poly1, xf1, nextEdge, poly2, xf2);
    if (sNext > 0) {
      return sNext;
    }
    let bestEdge: number;
    let bestSeparation: number;
    let increment: number;
    if (sPrev > s && sPrev > sNext) {
      increment = -1;
      bestEdge = prevEdge;
      bestSeparation = sPrev;
    } else {
      if (sNext <= s) {
        edgeIndexOut[0] = edge;
        return s;
      }
      increment = 1;
      bestEdge = nextEdge;
      bestSeparation = sNext;
    }
    while (true) {
      if (increment === -1) {
        edge = bestEdge - 1 >= 0 ? bestEdge - 1 : count1 - 1;
      } else {
        edge = bestEdge + 1 < count1 ? bestEdge + 1 : 0;
      }
      s = b2Collision.EdgeSeparation(poly1, xf1, edge, poly2, xf2);
      if (s > 0) {
        break;
      }
      if (s <= bestSeparation) {
        edgeIndexOut[0] = bestEdge;
        return bestSeparation;
      }
      bestEdge = edge;
      bestSeparation = s;
    }
    return s;
  }

  // b2Collision.as:206-257
  public static FindIncidentEdge(
    c: ClipVertex[],
    poly1: b2PolygonShape,
    xf1: b2XForm,
    edge1: number,
    poly2: b2PolygonShape,
    xf2: b2XForm,
  ): void {
    const normals1: b2Vec2[] = poly1.m_normals;
    const count2: number = poly2.m_vertexCount;
    const vertices2: b2Vec2[] = poly2.m_vertices;
    const normals2: b2Vec2[] = poly2.m_normals;
    let tMat: b2Mat22 = xf1.R;
    let tVec: b2Vec2 = normals1[edge1];
    let normal1X: number = tMat.col1.x * tVec.x + tMat.col2.x * tVec.y;
    let normal1Y: number = tMat.col1.y * tVec.x + tMat.col2.y * tVec.y;
    tMat = xf2.R;
    const tX: number = tMat.col1.x * normal1X + tMat.col1.y * normal1Y;
    normal1Y = tMat.col2.x * normal1X + tMat.col2.y * normal1Y;
    normal1X = tX;
    let index: number = 0;
    let minDot: number = Number.MAX_VALUE;
    let i: number = 0;
    while (i < count2) {
      tVec = normals2[i];
      const dot: number = normal1X * tVec.x + normal1Y * tVec.y;
      if (dot < minDot) {
        minDot = dot;
        index = i;
      }
      i++;
    }
    const i1: number = index;
    const i2: number = i1 + 1 < count2 ? i1 + 1 : 0;
    let cv: ClipVertex = c[0];
    tVec = vertices2[i1];
    tMat = xf2.R;
    cv.v.x = xf2.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    cv.v.y = xf2.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
    cv.id.features.referenceEdge = edge1;
    cv.id.features.incidentEdge = i1;
    cv.id.features.incidentVertex = 0;
    cv = c[1];
    tVec = vertices2[i2];
    tMat = xf2.R;
    cv.v.x = xf2.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    cv.v.y = xf2.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
    cv.id.features.referenceEdge = edge1;
    cv.id.features.incidentEdge = i2;
    cv.id.features.incidentVertex = 1;
  }

  // b2Collision.as:259-366
  public static b2CollidePolygons(
    manifold: b2Manifold,
    polyA: b2PolygonShape,
    xfA: b2XForm,
    polyB: b2PolygonShape,
    xfB: b2XForm,
  ): void {
    manifold.pointCount = 0;
    const edgeAOut: number[] = [0];
    const separationA: number = b2Collision.FindMaxSeparation(edgeAOut, polyA, xfA, polyB, xfB);
    const edgeA: number = edgeAOut[0];
    if (separationA > 0) {
      return;
    }
    const edgeBOut: number[] = [0];
    const separationB: number = b2Collision.FindMaxSeparation(edgeBOut, polyB, xfB, polyA, xfA);
    const edgeB: number = edgeBOut[0];
    if (separationB > 0) {
      return;
    }
    let poly1: b2PolygonShape;
    let poly2: b2PolygonShape;
    const xf1: b2XForm = new b2XForm();
    const xf2: b2XForm = new b2XForm();
    let edge1: number;
    let flip: number;
    const k_relativeTol: number = 0.98;
    const k_absoluteTol: number = 0.001;
    if (separationB > k_relativeTol * separationA + k_absoluteTol) {
      poly1 = polyB;
      poly2 = polyA;
      xf1.Set(xfB);
      xf2.Set(xfA);
      edge1 = edgeB;
      flip = 1;
    } else {
      poly1 = polyA;
      poly2 = polyB;
      xf1.Set(xfA);
      xf2.Set(xfB);
      edge1 = edgeA;
      flip = 0;
    }
    const incidentEdge: ClipVertex[] = [new ClipVertex(), new ClipVertex()];
    b2Collision.FindIncidentEdge(incidentEdge, poly1, xf1, edge1, poly2, xf2);
    const count1: number = poly1.m_vertexCount;
    const vertices1: b2Vec2[] = poly1.m_vertices;
    let tVec: b2Vec2 = vertices1[edge1];
    let v11: b2Vec2 = tVec.Copy();
    let v12: b2Vec2;
    if (edge1 + 1 < count1) {
      tVec = vertices1[edge1 + 1];
      v12 = tVec.Copy();
    } else {
      tVec = vertices1[0];
      v12 = tVec.Copy();
    }
    // (dead temp preserved from the .as)
    const _dv: b2Vec2 = b2Math.SubtractVV(v12, v11);
    void _dv;
    const sideNormal: b2Vec2 = b2Math.b2MulMV(xf1.R, b2Math.SubtractVV(v12, v11));
    sideNormal.Normalize();
    const frontNormal: b2Vec2 = b2Math.b2CrossVF(sideNormal, 1);
    v11 = b2Math.b2MulX(xf1, v11);
    v12 = b2Math.b2MulX(xf1, v12);
    const frontOffset: number = b2Math.b2Dot(frontNormal, v11);
    const sideOffset1: number = -b2Math.b2Dot(sideNormal, v11);
    const sideOffset2: number = b2Math.b2Dot(sideNormal, v12);
    const clipPoints1: ClipVertex[] = [new ClipVertex(), new ClipVertex()];
    const clipPoints2: ClipVertex[] = [new ClipVertex(), new ClipVertex()];
    let np: number = b2Collision.ClipSegmentToLine(clipPoints1, incidentEdge, sideNormal.Negative(), sideOffset1);
    if (np < 2) {
      return;
    }
    np = b2Collision.ClipSegmentToLine(clipPoints2, clipPoints1, sideNormal, sideOffset2);
    if (np < 2) {
      return;
    }
    manifold.normal = flip ? frontNormal.Negative() : frontNormal.Copy();
    let pointCount: number = 0;
    let i: number = 0;
    while (i < b2Settings.b2_maxManifoldPoints) {
      const cv: ClipVertex = clipPoints2[i];
      const separation: number = b2Math.b2Dot(frontNormal, cv.v) - frontOffset;
      if (separation <= 0) {
        const cp: b2ManifoldPoint = manifold.points[pointCount];
        cp.separation = separation;
        cp.localPoint1 = b2Math.b2MulXT(xfA, cv.v);
        cp.localPoint2 = b2Math.b2MulXT(xfB, cv.v);
        cp.id.key = cv.id._key;
        cp.id.features.flip = flip;
        pointCount++;
      }
      i++;
    }
    manifold.pointCount = pointCount;
  }

  // b2Collision.as:368-425
  public static b2CollideCircles(
    manifold: b2Manifold,
    circle1: b2CircleShape,
    xf1: b2XForm,
    circle2: b2CircleShape,
    xf2: b2XForm,
  ): void {
    manifold.pointCount = 0;
    let tMat: b2Mat22 = xf1.R;
    let tVec: b2Vec2 = circle1.m_localPosition;
    let p1X: number = xf1.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    let p1Y: number = xf1.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
    tMat = xf2.R;
    tVec = circle2.m_localPosition;
    let p2X: number = xf2.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    let p2Y: number = xf2.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
    const dX: number = p2X - p1X;
    const dY: number = p2Y - p1Y;
    const distSqr: number = dX * dX + dY * dY;
    const r1: number = circle1.m_radius;
    const r2: number = circle2.m_radius;
    const radiusSum: number = r1 + r2;
    if (distSqr > radiusSum * radiusSum) {
      return;
    }
    let separation: number;
    if (distSqr < Number.MIN_VALUE) {
      separation = -radiusSum;
      manifold.normal.Set(0, 1);
    } else {
      const dist: number = Math.sqrt(distSqr);
      separation = dist - radiusSum;
      const a: number = 1 / dist;
      manifold.normal.x = a * dX;
      manifold.normal.y = a * dY;
    }
    manifold.pointCount = 1;
    const cp: b2ManifoldPoint = manifold.points[0];
    cp.id.key = 0;
    cp.separation = separation;
    p1X += r1 * manifold.normal.x;
    p1Y += r1 * manifold.normal.y;
    p2X -= r2 * manifold.normal.x;
    p2Y -= r2 * manifold.normal.y;
    const pX: number = 0.5 * (p1X + p2X);
    const pY: number = 0.5 * (p1Y + p2Y);
    let tX: number = pX - xf1.position.x;
    let tY: number = pY - xf1.position.y;
    cp.localPoint1.x = tX * xf1.R.col1.x + tY * xf1.R.col1.y;
    cp.localPoint1.y = tX * xf1.R.col2.x + tY * xf1.R.col2.y;
    tX = pX - xf2.position.x;
    tY = pY - xf2.position.y;
    cp.localPoint2.x = tX * xf2.R.col1.x + tY * xf2.R.col1.y;
    cp.localPoint2.y = tX * xf2.R.col2.x + tY * xf2.R.col2.y;
  }

  // b2Collision.as:427-564
  public static b2CollidePolygonAndCircle(
    manifold: b2Manifold,
    polygon: b2PolygonShape,
    xf1: b2XForm,
    circle: b2CircleShape,
    xf2: b2XForm,
  ): void {
    manifold.pointCount = 0;
    let tMat: b2Mat22 = xf2.R;
    let tVec: b2Vec2 = circle.m_localPosition;
    const cWorldX: number = xf2.position.x + (tMat.col1.x * tVec.x + tMat.col2.x * tVec.y);
    const cWorldY: number = xf2.position.y + (tMat.col1.y * tVec.x + tMat.col2.y * tVec.y);
    let dX: number = cWorldX - xf1.position.x;
    let dY: number = cWorldY - xf1.position.y;
    tMat = xf1.R;
    const cLocalX: number = dX * tMat.col1.x + dY * tMat.col1.y;
    const cLocalY: number = dX * tMat.col2.x + dY * tMat.col2.y;
    let normalIndex: number = 0;
    let separation: number = -Number.MAX_VALUE;
    const radius: number = circle.m_radius;
    const vertexCount: number = polygon.m_vertexCount;
    const vertices: b2Vec2[] = polygon.m_vertices;
    const normals: b2Vec2[] = polygon.m_normals;
    let i: number = 0;
    while (i < vertexCount) {
      tVec = vertices[i];
      dX = cLocalX - tVec.x;
      dY = cLocalY - tVec.y;
      tVec = normals[i];
      const s: number = tVec.x * dX + tVec.y * dY;
      if (s > radius) {
        return;
      }
      if (s > separation) {
        separation = s;
        normalIndex = i;
      }
      i++;
    }
    let cp: b2ManifoldPoint;
    if (separation < Number.MIN_VALUE) {
      manifold.pointCount = 1;
      tVec = normals[normalIndex];
      tMat = xf1.R;
      manifold.normal.x = tMat.col1.x * tVec.x + tMat.col2.x * tVec.y;
      manifold.normal.y = tMat.col1.y * tVec.x + tMat.col2.y * tVec.y;
      cp = manifold.points[0];
      cp.id.features.incidentEdge = normalIndex;
      cp.id.features.incidentVertex = b2Collision.b2_nullFeature;
      cp.id.features.referenceEdge = 0;
      cp.id.features.flip = 0;
      const position1X: number = cWorldX - radius * manifold.normal.x;
      const position1Y: number = cWorldY - radius * manifold.normal.y;
      dX = position1X - xf1.position.x;
      dY = position1Y - xf1.position.y;
      tMat = xf1.R;
      cp.localPoint1.x = dX * tMat.col1.x + dY * tMat.col1.y;
      cp.localPoint1.y = dX * tMat.col2.x + dY * tMat.col2.y;
      dX = position1X - xf2.position.x;
      dY = position1Y - xf2.position.y;
      tMat = xf2.R;
      cp.localPoint2.x = dX * tMat.col1.x + dY * tMat.col1.y;
      cp.localPoint2.y = dX * tMat.col2.x + dY * tMat.col2.y;
      cp.separation = separation - radius;
      return;
    }
    const vertIndex1: number = normalIndex;
    const vertIndex2: number = vertIndex1 + 1 < vertexCount ? vertIndex1 + 1 : 0;
    tVec = vertices[vertIndex1];
    const v2: b2Vec2 = vertices[vertIndex2];
    let eX: number = v2.x - tVec.x;
    let eY: number = v2.y - tVec.y;
    const length: number = Math.sqrt(eX * eX + eY * eY);
    eX /= length;
    eY /= length;
    dX = cLocalX - tVec.x;
    dY = cLocalY - tVec.y;
    const u: number = dX * eX + dY * eY;
    cp = manifold.points[0];
    let pX: number;
    let pY: number;
    if (u <= 0) {
      pX = tVec.x;
      pY = tVec.y;
      cp.id.features.incidentEdge = b2Collision.b2_nullFeature;
      cp.id.features.incidentVertex = vertIndex1;
    } else if (u >= length) {
      pX = v2.x;
      pY = v2.y;
      cp.id.features.incidentEdge = b2Collision.b2_nullFeature;
      cp.id.features.incidentVertex = vertIndex2;
    } else {
      pX = eX * u + tVec.x;
      pY = eY * u + tVec.y;
      cp.id.features.incidentEdge = normalIndex;
      cp.id.features.incidentVertex = 0;
    }
    dX = cLocalX - pX;
    dY = cLocalY - pY;
    const dist: number = Math.sqrt(dX * dX + dY * dY);
    dX /= dist;
    dY /= dist;
    if (dist > radius) {
      return;
    }
    manifold.pointCount = 1;
    tMat = xf1.R;
    manifold.normal.x = tMat.col1.x * dX + tMat.col2.x * dY;
    manifold.normal.y = tMat.col1.y * dX + tMat.col2.y * dY;
    const position1X: number = cWorldX - radius * manifold.normal.x;
    const position1Y: number = cWorldY - radius * manifold.normal.y;
    dX = position1X - xf1.position.x;
    dY = position1Y - xf1.position.y;
    tMat = xf1.R;
    cp.localPoint1.x = dX * tMat.col1.x + dY * tMat.col1.y;
    cp.localPoint1.y = dX * tMat.col2.x + dY * tMat.col2.y;
    dX = position1X - xf2.position.x;
    dY = position1Y - xf2.position.y;
    tMat = xf2.R;
    cp.localPoint2.x = dX * tMat.col1.x + dY * tMat.col1.y;
    cp.localPoint2.y = dX * tMat.col2.x + dY * tMat.col2.y;
    cp.separation = dist - radius;
    cp.id.features.referenceEdge = 0;
    cp.id.features.flip = 0;
  }

  // b2Collision.as:566-585
  public static b2TestOverlap(a: b2AABB, b: b2AABB): boolean {
    let t1: b2Vec2 = b.lowerBound;
    let t2: b2Vec2 = a.upperBound;
    const d1X: number = t1.x - t2.x;
    const d1Y: number = t1.y - t2.y;
    t1 = a.lowerBound;
    t2 = b.upperBound;
    const d2X: number = t1.x - t2.x;
    const d2Y: number = t1.y - t2.y;
    if (d1X > 0 || d1Y > 0) {
      return false;
    }
    if (d2X > 0 || d2Y > 0) {
      return false;
    }
    return true;
  }
}
