// Port of Box2D/Common/Math/b2Mat22.as (Box2DFlash 2.0.2), line-by-line.
// The rotation-matrix build from Math.cos/Math.sin lives here (b2Mat22.as:24-29,
// 36-41) — the trig-ceiling surface (CLAUDE.md rule 5). Op order preserved.
import { b2Vec2 } from "./b2Vec2";

export class b2Mat22 {
  public col1: b2Vec2;
  public col2: b2Vec2;

  // b2Mat22.as:10-31
  // AS3 default args: angle:Number=0, c1:b2Vec2=null, c2:b2Vec2=null
  constructor(angle: number = 0, c1: b2Vec2 | null = null, c2: b2Vec2 | null = null) {
    this.col1 = new b2Vec2();
    this.col2 = new b2Vec2();
    if (c1 != null && c2 != null) {
      this.col1.SetV(c1);
      this.col2.SetV(c2);
    } else {
      const c: number = Math.cos(angle);
      const s: number = Math.sin(angle);
      this.col1.x = c;
      this.col2.x = -s;
      this.col1.y = s;
      this.col2.y = c;
    }
  }

  // b2Mat22.as:33-42
  public Set(angle: number): void {
    const c: number = Math.cos(angle);
    const s: number = Math.sin(angle);
    this.col1.x = c;
    this.col2.x = -s;
    this.col1.y = s;
    this.col2.y = c;
  }

  // b2Mat22.as:44-48
  public SetVV(c1: b2Vec2, c2: b2Vec2): void {
    this.col1.SetV(c1);
    this.col2.SetV(c2);
  }

  // b2Mat22.as:50-53
  public Copy(): b2Mat22 {
    return new b2Mat22(0, this.col1, this.col2);
  }

  // b2Mat22.as:55-59
  public SetM(m: b2Mat22): void {
    this.col1.SetV(m.col1);
    this.col2.SetV(m.col2);
  }

  // b2Mat22.as:61-67
  public AddM(m: b2Mat22): void {
    this.col1.x += m.col1.x;
    this.col1.y += m.col1.y;
    this.col2.x += m.col2.x;
    this.col2.y += m.col2.y;
  }

  // b2Mat22.as:69-75
  public SetIdentity(): void {
    this.col1.x = 1;
    this.col2.x = 0;
    this.col1.y = 0;
    this.col2.y = 1;
  }

  // b2Mat22.as:77-83
  public SetZero(): void {
    this.col1.x = 0;
    this.col2.x = 0;
    this.col1.y = 0;
    this.col2.y = 0;
  }

  // b2Mat22.as:85-88
  public GetAngle(): number {
    return Math.atan2(this.col1.y, this.col1.x);
  }

  // b2Mat22.as:90-106
  public Invert(out: b2Mat22): b2Mat22 {
    const a: number = this.col1.x;
    const b: number = this.col2.x;
    const c: number = this.col1.y;
    const d: number = this.col2.y;
    let det: number = a * d - b * c;
    det = 1 / det;
    out.col1.x = det * d;
    out.col2.x = -det * b;
    out.col1.y = -det * c;
    out.col2.y = det * a;
    return out;
  }

  // b2Mat22.as:108-119
  public Solve(out: b2Vec2, bX: number, bY: number): b2Vec2 {
    const a11: number = this.col1.x;
    const a12: number = this.col2.x;
    const a21: number = this.col1.y;
    const a22: number = this.col2.y;
    let det: number = a11 * a22 - a12 * a21;
    det = 1 / det;
    out.x = det * (a22 * bX - a12 * bY);
    out.y = det * (a11 * bY - a21 * bX);
    return out;
  }

  // b2Mat22.as:121-125
  public Abs(): void {
    this.col1.Abs();
    this.col2.Abs();
  }
}
