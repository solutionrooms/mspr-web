// Port of Box2D/Collision/Shapes/b2MassData.as (Box2DFlash 2.0.2), verbatim.
import { b2Vec2 } from "../../Common/Math/b2Vec2";

export class b2MassData {
  public mass: number = 0;
  public center: b2Vec2 = new b2Vec2(0, 0);
  public I: number = 0;
}
