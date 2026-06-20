// Port of Box2D/Collision/b2OBB.as (Box2DFlash 2.0.2), verbatim.
import { b2Mat22 } from "../Common/Math/b2Mat22";
import { b2Vec2 } from "../Common/Math/b2Vec2";

export class b2OBB {
  public R: b2Mat22 = new b2Mat22();
  public center: b2Vec2 = new b2Vec2();
  public extents: b2Vec2 = new b2Vec2();
}
