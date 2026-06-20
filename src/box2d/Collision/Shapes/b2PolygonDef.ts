// Port of Box2D/Collision/Shapes/b2PolygonDef.as (Box2DFlash 2.0.2), line-by-line.
import { b2ShapeDef } from "./b2ShapeDef";
import { b2Shape } from "./b2Shape";
import { b2Settings } from "../../Common/b2Settings";
import { b2Mat22 } from "../../Common/Math/b2Mat22";
import { b2Vec2 } from "../../Common/Math/b2Vec2";

export class b2PolygonDef extends b2ShapeDef {
  private static s_mat: b2Mat22 = new b2Mat22();

  public vertices: b2Vec2[] = new Array(b2Settings.b2_maxPolygonVertices);
  public vertexCount!: number;

  // b2PolygonDef.as:12-28
  constructor() {
    super();
    this.type = b2Shape.e_polygonShape;
    this.vertexCount = 0;
    let i = 0;
    while (i < b2Settings.b2_maxPolygonVertices) {
      this.vertices[i] = new b2Vec2();
      i++;
    }
  }

  // b2PolygonDef.as:30-39
  public SetAsBox(hx: number, hy: number): void {
    this.vertexCount = 4;
    this.vertices[0].Set(-hx, -hy);
    this.vertices[1].Set(hx, -hy);
    this.vertices[2].Set(hx, hy);
    this.vertices[3].Set(-hx, hy);
  }

  // b2PolygonDef.as:41-67
  public SetAsOrientedBox(hx: number, hy: number, center: b2Vec2 | null = null, angle: number = 0): void {
    this.vertexCount = 4;
    this.vertices[0].Set(-hx, -hy);
    this.vertices[1].Set(hx, -hy);
    this.vertices[2].Set(hx, hy);
    this.vertices[3].Set(-hx, hy);
    if (center) {
      const c: b2Vec2 = center;
      const mat: b2Mat22 = b2PolygonDef.s_mat;
      mat.Set(angle);
      let i = 0;
      while (i < this.vertexCount) {
        const v: b2Vec2 = this.vertices[i];
        const x: number = c.x + (mat.col1.x * v.x + mat.col2.x * v.y);
        v.y = c.y + (mat.col1.y * v.x + mat.col2.y * v.y);
        v.x = x;
        i++;
      }
    }
  }
}
