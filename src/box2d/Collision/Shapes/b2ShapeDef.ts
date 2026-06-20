// Port of Box2D/Collision/Shapes/b2ShapeDef.as (Box2DFlash 2.0.2), verbatim.
import { b2Shape } from "./b2Shape";
import { b2FilterData } from "./b2FilterData";

export class b2ShapeDef {
  public type: number = b2Shape.e_unknownShape;
  public userData: unknown = null;
  public friction: number = 0.2;
  public restitution: number = 0;
  public density: number = 0;
  public isSensor: boolean = false;
  public filter: b2FilterData = new b2FilterData();
}
