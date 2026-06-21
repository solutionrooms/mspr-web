// Port of Box2D/Collision/b2Point.as (Box2DFlash 2.0.2), verbatim.
// A degenerate "shape" (a single point) used by b2Distance to wrap a circle's centre so
// the polygon-vs-circle distance can reuse the generic GJK path. Duck-types the
// GetFirstVertex/Support surface b2DistanceGeneric needs (see b2SupportShape).
import { b2Vec2 } from "../Common/Math/b2Vec2";
import type { b2XForm } from "../Common/Math/b2XForm";

export class b2Point {
  public p: b2Vec2 = new b2Vec2();

  // b2Point.as:14-17
  public Support(_xf: b2XForm, _dX: number, _dY: number): b2Vec2 {
    return this.p;
  }
  // b2Point.as:19-22
  public GetFirstVertex(_xf: b2XForm): b2Vec2 {
    return this.p;
  }
}

// Structural type shared by b2PolygonShape and b2Point — the GJK support surface.
export interface b2SupportShape {
  GetFirstVertex(xf: b2XForm): b2Vec2;
  Support(xf: b2XForm, dX: number, dY: number): b2Vec2;
}
