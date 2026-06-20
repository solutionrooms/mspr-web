// Port of Box2D/Common/Math/b2Sweep.as (Box2DFlash 2.0.2), line-by-line.
// GetXForm rebuilds the rotation matrix (R.Set -> Math.cos/sin) at an interpolated
// angle — the TOI sub-step trig surface (CLAUDE.md rule 5). Op order preserved.
import { b2Vec2 } from "./b2Vec2";
import type { b2XForm } from "./b2XForm";
import type { b2Mat22 } from "./b2Mat22";

export class b2Sweep {
  public localCenter: b2Vec2 = new b2Vec2();
  public c0: b2Vec2 = new b2Vec2();
  public c: b2Vec2 = new b2Vec2();
  public a0!: number;
  public a!: number;
  public t0!: number;

  // b2Sweep.as:23-43
  public GetXForm(xf: b2XForm, t: number): void {
    if (1 - this.t0 > Number.MIN_VALUE) {
      const alpha: number = (t - this.t0) / (1 - this.t0);
      xf.position.x = (1 - alpha) * this.c0.x + alpha * this.c.x;
      xf.position.y = (1 - alpha) * this.c0.y + alpha * this.c.y;
      const angle: number = (1 - alpha) * this.a0 + alpha * this.a;
      xf.R.Set(angle);
    } else {
      xf.position.SetV(this.c);
      xf.R.Set(this.a);
    }
    const R: b2Mat22 = xf.R;
    xf.position.x -= R.col1.x * this.localCenter.x + R.col2.x * this.localCenter.y;
    xf.position.y -= R.col1.y * this.localCenter.x + R.col2.y * this.localCenter.y;
  }

  // b2Sweep.as:45-56
  public Advance(t: number): void {
    if (this.t0 < t && 1 - this.t0 > Number.MIN_VALUE) {
      const alpha: number = (t - this.t0) / (1 - this.t0);
      this.c0.x = (1 - alpha) * this.c0.x + alpha * this.c.x;
      this.c0.y = (1 - alpha) * this.c0.y + alpha * this.c.y;
      this.a0 = (1 - alpha) * this.a0 + alpha * this.a;
      this.t0 = t;
    }
  }
}
