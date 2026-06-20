// Port of Box2D/Dynamics/b2ContactFilter.as (Box2DFlash 2.0.2).
// b2_defaultFilter is read by the b2World constructor. ShouldCollide/RayCollide are
// only called once shapes exist (m2); their param type b2Shape is the scaffold for
// now. The logic is ported faithfully so it is ready when collision lands.
import type { b2Shape } from "../Collision/Shapes/b2Shape";
import type { b2FilterData } from "../Collision/Shapes/b2FilterData";

export class b2ContactFilter {
  // b2ContactFilter.as:9
  public static readonly b2_defaultFilter: b2ContactFilter = new b2ContactFilter();

  // b2ContactFilter.as:16-25
  public ShouldCollide(shape1: b2Shape, shape2: b2Shape): boolean {
    const filter1: b2FilterData = (shape1 as unknown as { GetFilterData(): b2FilterData }).GetFilterData();
    const filter2: b2FilterData = (shape2 as unknown as { GetFilterData(): b2FilterData }).GetFilterData();
    if (filter1.groupIndex === filter2.groupIndex && filter1.groupIndex !== 0) {
      return filter1.groupIndex > 0;
    }
    return (filter1.maskBits & filter2.categoryBits) !== 0 && (filter1.categoryBits & filter2.maskBits) !== 0;
  }

  // b2ContactFilter.as:27-34
  public RayCollide(userData: unknown, shape: b2Shape): boolean {
    if (!userData) {
      return true;
    }
    return this.ShouldCollide(userData as b2Shape, shape);
  }
}
