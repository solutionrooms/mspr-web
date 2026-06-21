// Port of Box2D/Dynamics/Joints/b2Jacobian.as (Box2DFlash 2.0.2), verbatim.
import { b2Vec2 } from "../../Common/Math/b2Vec2";

export class b2Jacobian {
  public linear1: b2Vec2 = new b2Vec2();
  public angular1!: number;
  public linear2: b2Vec2 = new b2Vec2();
  public angular2!: number;

  public SetZero(): void {
    this.linear1.SetZero();
    this.angular1 = 0;
    this.linear2.SetZero();
    this.angular2 = 0;
  }

  public Set(x1: b2Vec2, a1: number, x2: b2Vec2, a2: number): void {
    this.linear1.SetV(x1);
    this.angular1 = a1;
    this.linear2.SetV(x2);
    this.angular2 = a2;
  }

  public Compute(x1: b2Vec2, a1: number, x2: b2Vec2, a2: number): number {
    return (
      this.linear1.x * x1.x +
      this.linear1.y * x1.y +
      this.angular1 * a1 +
      (this.linear2.x * x2.x + this.linear2.y * x2.y) +
      this.angular2 * a2
    );
  }
}
