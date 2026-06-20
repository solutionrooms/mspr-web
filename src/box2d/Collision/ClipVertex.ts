// Port of Box2D/Collision/ClipVertex.as (Box2DFlash 2.0.2), verbatim.
import { b2Vec2 } from "../Common/Math/b2Vec2";
import { b2ContactID } from "./b2ContactID";

export class ClipVertex {
  public v: b2Vec2 = new b2Vec2();
  public id: b2ContactID = new b2ContactID();
}
