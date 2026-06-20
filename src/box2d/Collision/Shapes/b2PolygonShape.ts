// Port of Box2D/Collision/Shapes/b2PolygonShape.as (Box2DFlash 2.0.2), line-by-line.
// Op order preserved exactly. The constructor builds normals, centroid, OBB and the
// TOI-slop-inset core vertices; ComputeMass returns area-weighted mass/centroid/I.
// All arithmetic is +-*/ and sqrt (no trig) -> bit-exact-able vs Ruffle.
import { b2Shape } from "./b2Shape";
import { b2PolygonDef } from "./b2PolygonDef";
import type { b2ShapeDef } from "./b2ShapeDef";
import type { b2MassData } from "./b2MassData";
import { b2Settings } from "../../Common/b2Settings";
import { b2Math } from "../../Common/Math/b2Math";
import { b2Mat22 } from "../../Common/Math/b2Mat22";
import { b2Vec2 } from "../../Common/Math/b2Vec2";
import type { b2XForm } from "../../Common/Math/b2XForm";
import { b2OBB } from "../b2OBB";
import { b2AABB } from "../b2AABB";
import type { b2Segment } from "../b2Segment";
import { registerShapeCtor } from "./_shapeFactory";

export class b2PolygonShape extends b2Shape {
  // b2PolygonShape.as:11-15 (statics)
  private static s_computeMat: b2Mat22 = new b2Mat22();
  private static s_sweptAABB1: b2AABB = new b2AABB();
  private static s_sweptAABB2: b2AABB = new b2AABB();

  private s_supportVec: b2Vec2;
  public m_centroid!: b2Vec2;
  public m_obb: b2OBB;
  public m_vertices: b2Vec2[];
  public m_normals: b2Vec2[];
  public m_coreVertices: b2Vec2[];
  public m_vertexCount!: number;

  // b2PolygonShape.as:31-93
  constructor(def: b2ShapeDef) {
    super(def);
    this.s_supportVec = new b2Vec2();
    this.m_obb = new b2OBB();
    this.m_vertices = new Array(b2Settings.b2_maxPolygonVertices);
    this.m_normals = new Array(b2Settings.b2_maxPolygonVertices);
    this.m_coreVertices = new Array(b2Settings.b2_maxPolygonVertices);
    this.m_type = b2Shape.e_polygonShape;
    const polyDef: b2PolygonDef = def as b2PolygonDef;
    this.m_vertexCount = polyDef.vertexCount;
    let i = 0;
    while (i < this.m_vertexCount) {
      this.m_vertices[i] = polyDef.vertices[i].Copy();
      i++;
    }
    i = 0;
    while (i < this.m_vertexCount) {
      const i1: number = i;
      const i2: number = i + 1 < this.m_vertexCount ? i + 1 : 0;
      const edgeX: number = this.m_vertices[i2].x - this.m_vertices[i1].x;
      const edgeY: number = this.m_vertices[i2].y - this.m_vertices[i1].y;
      const len: number = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
      this.m_normals[i] = new b2Vec2(edgeY / len, -edgeX / len);
      i++;
    }
    this.m_centroid = b2PolygonShape.ComputeCentroid(polyDef.vertices, polyDef.vertexCount);
    b2PolygonShape.ComputeOBB(this.m_obb, this.m_vertices, this.m_vertexCount);
    i = 0;
    while (i < this.m_vertexCount) {
      const i1: number = i - 1 >= 0 ? i - 1 : this.m_vertexCount - 1;
      const i2: number = i;
      const n1x: number = this.m_normals[i1].x;
      const n1y: number = this.m_normals[i1].y;
      const n2x: number = this.m_normals[i2].x;
      const n2y: number = this.m_normals[i2].y;
      const vX: number = this.m_vertices[i].x - this.m_centroid.x;
      const vY: number = this.m_vertices[i].y - this.m_centroid.y;
      const d1: number = n1x * vX + n1y * vY - b2Settings.b2_toiSlop;
      const d2: number = n2x * vX + n2y * vY - b2Settings.b2_toiSlop;
      const invDet: number = 1 / (n1x * n2y - n1y * n2x);
      this.m_coreVertices[i] = new b2Vec2(
        invDet * (n2y * d1 - n1y * d2) + this.m_centroid.x,
        invDet * (n1x * d2 - n2x * d1) + this.m_centroid.y,
      );
      i++;
    }
  }

  // b2PolygonShape.as:95-131
  public static ComputeCentroid(vs: b2Vec2[], count: number): b2Vec2 {
    const c: b2Vec2 = new b2Vec2();
    let area: number = 0;
    const p1x: number = 0;
    const p1y: number = 0;
    const inv3: number = 1 / 3;
    let i = 0;
    while (i < count) {
      const p2: b2Vec2 = vs[i];
      const p3: b2Vec2 = i + 1 < count ? vs[i + 1] : vs[0];
      const e1x: number = p2.x - p1x;
      const e1y: number = p2.y - p1y;
      const e2x: number = p3.x - p1x;
      const e2y: number = p3.y - p1y;
      const D: number = e1x * e2y - e1y * e2x;
      const triangleArea: number = 0.5 * D;
      area += triangleArea;
      c.x += triangleArea * inv3 * (p1x + p2.x + p3.x);
      c.y += triangleArea * inv3 * (p1y + p2.y + p3.y);
      i++;
    }
    c.x *= 1 / area;
    c.y *= 1 / area;
    return c;
  }

  // b2PolygonShape.as:133-222
  public static ComputeOBB(obb: b2OBB, vs: b2Vec2[], count: number): void {
    const p: b2Vec2[] = new Array(b2Settings.b2_maxPolygonVertices + 1);
    let i = 0;
    while (i < count) {
      p[i] = vs[i];
      i++;
    }
    p[count] = p[0];
    let minArea: number = Number.MAX_VALUE;
    i = 1;
    while (i <= count) {
      const root: b2Vec2 = p[i - 1];
      let uxX: number = p[i].x - root.x;
      let uxY: number = p[i].y - root.y;
      const length: number = Math.sqrt(uxX * uxX + uxY * uxY);
      uxX /= length;
      uxY /= length;
      const uyX: number = -uxY;
      const uyY: number = uxX;
      let lowerX: number = Number.MAX_VALUE;
      let lowerY: number = Number.MAX_VALUE;
      let upperX: number = -Number.MAX_VALUE;
      let upperY: number = -Number.MAX_VALUE;
      let j = 0;
      while (j < count) {
        const dX: number = p[j].x - root.x;
        const dY: number = p[j].y - root.y;
        const rX: number = uxX * dX + uxY * dY;
        const rY: number = uyX * dX + uyY * dY;
        if (rX < lowerX) {
          lowerX = rX;
        }
        if (rY < lowerY) {
          lowerY = rY;
        }
        if (rX > upperX) {
          upperX = rX;
        }
        if (rY > upperY) {
          upperY = rY;
        }
        j++;
      }
      const area: number = (upperX - lowerX) * (upperY - lowerY);
      if (area < 0.95 * minArea) {
        minArea = area;
        obb.R.col1.x = uxX;
        obb.R.col1.y = uxY;
        obb.R.col2.x = uyX;
        obb.R.col2.y = uyY;
        const centerX: number = 0.5 * (lowerX + upperX);
        const centerY: number = 0.5 * (lowerY + upperY);
        const tMat: b2Mat22 = obb.R;
        obb.center.x = root.x + (tMat.col1.x * centerX + tMat.col2.x * centerY);
        obb.center.y = root.y + (tMat.col1.y * centerX + tMat.col2.y * centerY);
        obb.extents.x = 0.5 * (upperX - lowerX);
        obb.extents.y = 0.5 * (upperY - lowerY);
      }
      i++;
    }
  }

  // b2PolygonShape.as:224-248
  public override TestPoint(transform: b2XForm, p: b2Vec2): boolean {
    const tMat: b2Mat22 = transform.R;
    let tX: number = p.x - transform.position.x;
    let tY: number = p.y - transform.position.y;
    const localX: number = tX * tMat.col1.x + tY * tMat.col1.y;
    const localY: number = tX * tMat.col2.x + tY * tMat.col2.y;
    let i = 0;
    while (i < this.m_vertexCount) {
      let v: b2Vec2 = this.m_vertices[i];
      tX = localX - v.x;
      tY = localY - v.y;
      v = this.m_normals[i];
      const dot: number = v.x * tX + v.y * tY;
      if (dot > 0) {
        return false;
      }
      i++;
    }
    return true;
  }

  // b2PolygonShape.as:250-308
  public override TestSegment(
    transform: b2XForm,
    lambda: number[],
    normal: b2Vec2,
    segment: b2Segment,
    maxLambda: number,
  ): number {
    let lower: number = 0;
    let upper: number = maxLambda;
    let tX: number = segment.p1.x - transform.position.x;
    let tY: number = segment.p1.y - transform.position.y;
    let tMat: b2Mat22 = transform.R;
    const p1X: number = tX * tMat.col1.x + tY * tMat.col1.y;
    const p1Y: number = tX * tMat.col2.x + tY * tMat.col2.y;
    tX = segment.p2.x - transform.position.x;
    tY = segment.p2.y - transform.position.y;
    tMat = transform.R;
    const p2X: number = tX * tMat.col1.x + tY * tMat.col1.y;
    const p2Y: number = tX * tMat.col2.x + tY * tMat.col2.y;
    const dX: number = p2X - p1X;
    const dY: number = p2Y - p1Y;
    let index: number = -1;
    let i = 0;
    while (i < this.m_vertexCount) {
      let v: b2Vec2 = this.m_vertices[i];
      tX = v.x - p1X;
      tY = v.y - p1Y;
      v = this.m_normals[i];
      const numerator: number = v.x * tX + v.y * tY;
      const denominator: number = v.x * dX + v.y * dY;
      if (denominator < 0 && numerator < lower * denominator) {
        lower = numerator / denominator;
        index = i;
      } else if (denominator > 0 && numerator < upper * denominator) {
        upper = numerator / denominator;
      }
      if (upper < lower) {
        return b2Shape.e_missCollide;
      }
      i++;
    }
    if (index >= 0) {
      lambda[0] = lower;
      tMat = transform.R;
      const v: b2Vec2 = this.m_normals[index];
      normal.x = tMat.col1.x * v.x + tMat.col2.x * v.y;
      normal.y = tMat.col1.y * v.x + tMat.col2.y * v.y;
      return b2Shape.e_hitCollide;
    }
    lambda[0] = 0;
    return b2Shape.e_startsInsideCollide;
  }

  // b2PolygonShape.as:310-333
  public override ComputeAABB(aabb: b2AABB, transform: b2XForm): void {
    const computeMat: b2Mat22 = b2PolygonShape.s_computeMat;
    let tMat: b2Mat22 = transform.R;
    let obbR: b2Vec2 = this.m_obb.R.col1;
    computeMat.col1.x = tMat.col1.x * obbR.x + tMat.col2.x * obbR.y;
    computeMat.col1.y = tMat.col1.y * obbR.x + tMat.col2.y * obbR.y;
    obbR = this.m_obb.R.col2;
    computeMat.col2.x = tMat.col1.x * obbR.x + tMat.col2.x * obbR.y;
    computeMat.col2.y = tMat.col1.y * obbR.x + tMat.col2.y * obbR.y;
    computeMat.Abs();
    const absMat: b2Mat22 = computeMat;
    let ext: b2Vec2 = this.m_obb.extents;
    const hX: number = absMat.col1.x * ext.x + absMat.col2.x * ext.y;
    const hY: number = absMat.col1.y * ext.x + absMat.col2.y * ext.y;
    tMat = transform.R;
    ext = this.m_obb.center;
    const positionX: number = transform.position.x + (tMat.col1.x * ext.x + tMat.col2.x * ext.y);
    const positionY: number = transform.position.y + (tMat.col1.y * ext.x + tMat.col2.y * ext.y);
    aabb.lowerBound.Set(positionX - hX, positionY - hY);
    aabb.upperBound.Set(positionX + hX, positionY + hY);
  }

  // b2PolygonShape.as:335-343
  public override ComputeSweptAABB(aabb: b2AABB, transform1: b2XForm, transform2: b2XForm): void {
    const aabb1: b2AABB = b2PolygonShape.s_sweptAABB1;
    const aabb2: b2AABB = b2PolygonShape.s_sweptAABB2;
    this.ComputeAABB(aabb1, transform1);
    this.ComputeAABB(aabb2, transform2);
    aabb.lowerBound.Set(
      aabb1.lowerBound.x < aabb2.lowerBound.x ? aabb1.lowerBound.x : aabb2.lowerBound.x,
      aabb1.lowerBound.y < aabb2.lowerBound.y ? aabb1.lowerBound.y : aabb2.lowerBound.y,
    );
    aabb.upperBound.Set(
      aabb1.upperBound.x > aabb2.upperBound.x ? aabb1.upperBound.x : aabb2.upperBound.x,
      aabb1.upperBound.y > aabb2.upperBound.y ? aabb1.upperBound.y : aabb2.upperBound.y,
    );
  }

  // b2PolygonShape.as:345-400
  public override ComputeMass(massData: b2MassData): void {
    let centerX: number = 0;
    let centerY: number = 0;
    let area: number = 0;
    let I: number = 0;
    const p1x: number = 0;
    const p1y: number = 0;
    const k_inv3: number = 1 / 3;
    let i = 0;
    while (i < this.m_vertexCount) {
      const p2: b2Vec2 = this.m_vertices[i];
      const p3: b2Vec2 = i + 1 < this.m_vertexCount ? this.m_vertices[i + 1] : this.m_vertices[0];
      const e1X: number = p2.x - p1x;
      const e1Y: number = p2.y - p1y;
      const e2X: number = p3.x - p1x;
      const e2Y: number = p3.y - p1y;
      const D: number = e1X * e2Y - e1Y * e2X;
      const triangleArea: number = 0.5 * D;
      area += triangleArea;
      centerX += triangleArea * k_inv3 * (p1x + p2.x + p3.x);
      centerY += triangleArea * k_inv3 * (p1y + p2.y + p3.y);
      const px: number = p1x;
      const py: number = p1y;
      const ex1: number = e1X;
      const ey1: number = e1Y;
      const ex2: number = e2X;
      const ey2: number = e2Y;
      const intx2: number = k_inv3 * (0.25 * (ex1 * ex1 + ex2 * ex1 + ex2 * ex2) + (px * ex1 + px * ex2)) + 0.5 * px * px;
      const inty2: number = k_inv3 * (0.25 * (ey1 * ey1 + ey2 * ey1 + ey2 * ey2) + (py * ey1 + py * ey2)) + 0.5 * py * py;
      I += D * (intx2 + inty2);
      i++;
    }
    massData.mass = this.m_density * area;
    centerX *= 1 / area;
    centerY *= 1 / area;
    massData.center.Set(centerX, centerY);
    massData.I = this.m_density * I;
  }

  // b2PolygonShape.as:402-430
  public GetOBB(): b2OBB {
    return this.m_obb;
  }
  public GetCentroid(): b2Vec2 {
    return this.m_centroid;
  }
  public GetVertexCount(): number {
    return this.m_vertexCount;
  }
  public GetVertices(): b2Vec2[] {
    return this.m_vertices;
  }
  public GetCoreVertices(): b2Vec2[] {
    return this.m_coreVertices;
  }
  public GetNormals(): b2Vec2[] {
    return this.m_normals;
  }

  // b2PolygonShape.as:432-440
  public GetFirstVertex(transform: b2XForm): b2Vec2 {
    return b2Math.b2MulX(transform, this.m_coreVertices[0]);
  }
  public Centroid(transform: b2XForm): b2Vec2 {
    return b2Math.b2MulX(transform, this.m_centroid);
  }

  // b2PolygonShape.as:442-470
  public Support(transform: b2XForm, dX: number, dY: number): b2Vec2 {
    let tMat: b2Mat22 = transform.R;
    const dLocalX: number = dX * tMat.col1.x + dY * tMat.col1.y;
    const dLocalY: number = dX * tMat.col2.x + dY * tMat.col2.y;
    let bestIndex: number = 0;
    let v: b2Vec2 = this.m_coreVertices[0];
    let bestValue: number = v.x * dLocalX + v.y * dLocalY;
    let i = 1;
    while (i < this.m_vertexCount) {
      v = this.m_coreVertices[i];
      const value: number = v.x * dLocalX + v.y * dLocalY;
      if (value > bestValue) {
        bestIndex = i;
        bestValue = value;
      }
      i++;
    }
    tMat = transform.R;
    v = this.m_coreVertices[bestIndex];
    this.s_supportVec.x = transform.position.x + (tMat.col1.x * v.x + tMat.col2.x * v.y);
    this.s_supportVec.y = transform.position.y + (tMat.col1.y * v.x + tMat.col2.y * v.y);
    return this.s_supportVec;
  }

  // b2PolygonShape.as:472-491
  public override UpdateSweepRadius(center: b2Vec2): void {
    this.m_sweepRadius = 0;
    let i = 0;
    while (i < this.m_vertexCount) {
      const v: b2Vec2 = this.m_coreVertices[i];
      const dX: number = v.x - center.x;
      const dY: number = v.y - center.y;
      const d: number = Math.sqrt(dX * dX + dY * dY);
      if (d > this.m_sweepRadius) {
        this.m_sweepRadius = d;
      }
      i++;
    }
  }
}

// Register with the factory so b2Shape.Create(def) dispatches to us.
registerShapeCtor(b2Shape.e_polygonShape, (def: b2ShapeDef) => new b2PolygonShape(def));
