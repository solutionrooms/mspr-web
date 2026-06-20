// Port of Box2D/Common/Math/b2XForm.as (Box2DFlash 2.0.2), line-by-line.
import { b2Vec2 } from "./b2Vec2";
import { b2Mat22 } from "./b2Mat22";

export class b2XForm {
  public position: b2Vec2 = new b2Vec2();
  public R: b2Mat22 = new b2Mat22();

  // b2XForm.as:10-18
  constructor(pos: b2Vec2 | null = null, r: b2Mat22 | null = null) {
    if (pos) {
      this.position.SetV(pos);
      this.R.SetM(r as b2Mat22);
    }
  }

  // b2XForm.as:20-24
  public Initialize(pos: b2Vec2, r: b2Mat22): void {
    this.position.SetV(pos);
    this.R.SetM(r);
  }

  // b2XForm.as:26-30
  public SetIdentity(): void {
    this.position.SetZero();
    this.R.SetIdentity();
  }

  // b2XForm.as:32-36
  public Set(x: b2XForm): void {
    this.position.SetV(x.position);
    this.R.SetM(x.R);
  }
}
