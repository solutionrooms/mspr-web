// Port of Box2D/Collision/b2AABB.as (Box2DFlash 2.0.2), verbatim.
import { b2Vec2 } from "../Common/Math/b2Vec2";

export class b2AABB {
  public lowerBound: b2Vec2 = new b2Vec2();
  public upperBound: b2Vec2 = new b2Vec2();

  // b2AABB.as:17-23
  public IsValid(): boolean {
    const dX: number = this.upperBound.x - this.lowerBound.x;
    const dY: number = this.upperBound.y - this.lowerBound.y;
    let valid: boolean = dX >= 0 && dY >= 0;
    valid = valid && this.lowerBound.IsValid() && this.upperBound.IsValid();
    return valid;
  }
}
