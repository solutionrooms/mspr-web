// Port of Box2D/Common/Math/b2Vec2.as (Box2DFlash 2.0.2), line-by-line.
// Operation order preserved exactly — do NOT simplify arithmetic.
import type { b2Mat22 } from "./b2Mat22";

// NOTE: b2Vec2 deliberately does NOT import b2Math at runtime (only type imports
// elsewhere reference it). b2Math's static consts construct b2Vec2/b2Mat22/b2XForm
// at module-eval time; importing b2Math here would create an ESM init cycle that
// throws "Cannot access b2Vec2 before initialization". The two b2Math helpers
// b2Vec2 needs (b2Dot, b2IsValid) are inlined below as their exact expressions —
// bit-identical arithmetic, op order preserved.

export class b2Vec2 {
  public x: number;
  public y: number;

  // b2Vec2.as:10-15
  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  // b2Vec2.as:17-20
  public static Make(x: number, y: number): b2Vec2 {
    return new b2Vec2(x, y);
  }

  // b2Vec2.as:22-26
  public SetZero(): void {
    this.x = 0;
    this.y = 0;
  }

  // b2Vec2.as:28-32
  public Set(x: number = 0, y: number = 0): void {
    this.x = x;
    this.y = y;
  }

  // b2Vec2.as:34-38
  public SetV(v: b2Vec2): void {
    this.x = v.x;
    this.y = v.y;
  }

  // b2Vec2.as:40-43
  public Negative(): b2Vec2 {
    return new b2Vec2(-this.x, -this.y);
  }

  // b2Vec2.as:45-48
  public Copy(): b2Vec2 {
    return new b2Vec2(this.x, this.y);
  }

  // b2Vec2.as:50-54
  public Add(v: b2Vec2): void {
    this.x += v.x;
    this.y += v.y;
  }

  // b2Vec2.as:56-60
  public Subtract(v: b2Vec2): void {
    this.x -= v.x;
    this.y -= v.y;
  }

  // b2Vec2.as:62-66
  public Multiply(a: number): void {
    this.x *= a;
    this.y *= a;
  }

  // b2Vec2.as:68-73
  public MulM(A: b2Mat22): void {
    const tX: number = this.x;
    this.x = A.col1.x * tX + A.col2.x * this.y;
    this.y = A.col1.y * tX + A.col2.y * this.y;
  }

  // b2Vec2.as:75-80  (b2Math.b2Dot inlined: a.x*b.x + a.y*b.y — b2Math.as:22-25)
  public MulTM(A: b2Mat22): void {
    const tX: number = this.x * A.col1.x + this.y * A.col1.y;
    this.y = this.x * A.col2.x + this.y * A.col2.y;
    this.x = tX;
  }

  // b2Vec2.as:82-87
  public CrossVF(s: number): void {
    const tX: number = this.x;
    this.x = s * this.y;
    this.y = -s * tX;
  }

  // b2Vec2.as:89-94
  public CrossFV(s: number): void {
    const tX: number = this.x;
    this.x = -s * this.y;
    this.y = s * tX;
  }

  // b2Vec2.as:96-100
  public MinV(b: b2Vec2): void {
    this.x = this.x < b.x ? this.x : b.x;
    this.y = this.y < b.y ? this.y : b.y;
  }

  // b2Vec2.as:102-106
  public MaxV(b: b2Vec2): void {
    this.x = this.x > b.x ? this.x : b.x;
    this.y = this.y > b.y ? this.y : b.y;
  }

  // b2Vec2.as:108-118
  public Abs(): void {
    if (this.x < 0) {
      this.x = -this.x;
    }
    if (this.y < 0) {
      this.y = -this.y;
    }
  }

  // b2Vec2.as:120-123
  public Length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  // b2Vec2.as:125-128
  public LengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  // b2Vec2.as:130-141
  public Normalize(): number {
    const length: number = Math.sqrt(this.x * this.x + this.y * this.y);
    if (length < Number.MIN_VALUE) {
      return 0;
    }
    const invLength: number = 1 / length;
    this.x *= invLength;
    this.y *= invLength;
    return length;
  }

  // b2Vec2.as:143-146  (b2Math.b2IsValid inlined: isFinite(x) — b2Math.as:17-20)
  public IsValid(): boolean {
    return isFinite(this.x) && isFinite(this.y);
  }
}
