// Port of Box2D/Collision/b2Manifold.as (Box2DFlash 2.0.2), line-by-line.
import { b2Settings } from "../Common/b2Settings";
import { b2Vec2 } from "../Common/Math/b2Vec2";
import { b2ManifoldPoint } from "./b2ManifoldPoint";

export class b2Manifold {
  public points: b2ManifoldPoint[];
  public normal: b2Vec2;
  public pointCount: number = 0;

  // b2Manifold.as:16-30
  constructor() {
    this.points = new Array(b2Settings.b2_maxManifoldPoints);
    let i = 0;
    while (i < b2Settings.b2_maxManifoldPoints) {
      this.points[i] = new b2ManifoldPoint();
      i++;
    }
    this.normal = new b2Vec2();
  }

  // b2Manifold.as:32-42
  public Reset(): void {
    let i = 0;
    while (i < b2Settings.b2_maxManifoldPoints) {
      this.points[i].Reset();
      i++;
    }
    this.normal.SetZero();
    this.pointCount = 0;
  }

  // b2Manifold.as:44-54
  public Set(m: b2Manifold): void {
    this.pointCount = m.pointCount;
    let i = 0;
    while (i < b2Settings.b2_maxManifoldPoints) {
      this.points[i].Set(m.points[i]);
      i++;
    }
    this.normal.SetV(m.normal);
  }
}
