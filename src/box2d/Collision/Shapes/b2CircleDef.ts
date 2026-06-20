// Port of Box2D/Collision/Shapes/b2CircleDef.as (Box2DFlash 2.0.2), verbatim.
import { b2ShapeDef } from "./b2ShapeDef";
import { b2Shape } from "./b2Shape";
import { b2Vec2 } from "../../Common/Math/b2Vec2";

export class b2CircleDef extends b2ShapeDef {
  public localPosition: b2Vec2 = new b2Vec2(0, 0);
  public radius: number;

  // b2CircleDef.as:9-13
  constructor() {
    super();
    this.type = b2Shape.e_circleShape;
    this.radius = 1;
  }
}
