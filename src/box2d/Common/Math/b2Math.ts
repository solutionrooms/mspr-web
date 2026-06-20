// Port of Box2D/Common/Math/b2Math.as (Box2DFlash 2.0.2), line-by-line.
// Op order preserved exactly. b2Random/b2RandomRange use Math.random — they exist
// for fidelity but MUST NOT be called in the sim (determinism hygiene).
import { b2Vec2 } from "./b2Vec2";
import { b2Mat22 } from "./b2Mat22";
import { b2XForm } from "./b2XForm";

export class b2Math {
  // b2Math.as:6-10
  public static readonly b2Vec2_zero: b2Vec2 = new b2Vec2(0, 0);
  public static readonly b2Mat22_identity: b2Mat22 = new b2Mat22(0, new b2Vec2(1, 0), new b2Vec2(0, 1));
  public static readonly b2XForm_identity: b2XForm = new b2XForm(b2Math.b2Vec2_zero, b2Math.b2Mat22_identity);

  // b2Math.as:17-20
  public static b2IsValid(x: number): boolean {
    return isFinite(x);
  }

  // b2Math.as:22-25
  public static b2Dot(a: b2Vec2, b: b2Vec2): number {
    return a.x * b.x + a.y * b.y;
  }

  // b2Math.as:27-30
  public static b2CrossVV(a: b2Vec2, b: b2Vec2): number {
    return a.x * b.y - a.y * b.x;
  }

  // b2Math.as:32-35
  public static b2CrossVF(a: b2Vec2, s: number): b2Vec2 {
    return new b2Vec2(s * a.y, -s * a.x);
  }

  // b2Math.as:37-40
  public static b2CrossFV(s: number, a: b2Vec2): b2Vec2 {
    return new b2Vec2(-s * a.y, s * a.x);
  }

  // b2Math.as:42-45
  public static b2MulMV(A: b2Mat22, v: b2Vec2): b2Vec2 {
    return new b2Vec2(A.col1.x * v.x + A.col2.x * v.y, A.col1.y * v.x + A.col2.y * v.y);
  }

  // b2Math.as:47-50
  public static b2MulTMV(A: b2Mat22, v: b2Vec2): b2Vec2 {
    return new b2Vec2(b2Math.b2Dot(v, A.col1), b2Math.b2Dot(v, A.col2));
  }

  // b2Math.as:52-59
  public static b2MulX(T: b2XForm, v: b2Vec2): b2Vec2 {
    const a: b2Vec2 = b2Math.b2MulMV(T.R, v);
    a.x += T.position.x;
    a.y += T.position.y;
    return a;
  }

  // b2Math.as:61-70
  public static b2MulXT(T: b2XForm, v: b2Vec2): b2Vec2 {
    const a: b2Vec2 = b2Math.SubtractVV(v, T.position);
    const tX: number = a.x * T.R.col1.x + a.y * T.R.col1.y;
    a.y = a.x * T.R.col2.x + a.y * T.R.col2.y;
    a.x = tX;
    return a;
  }

  // b2Math.as:72-75
  public static AddVV(a: b2Vec2, b: b2Vec2): b2Vec2 {
    return new b2Vec2(a.x + b.x, a.y + b.y);
  }

  // b2Math.as:77-80
  public static SubtractVV(a: b2Vec2, b: b2Vec2): b2Vec2 {
    return new b2Vec2(a.x - b.x, a.y - b.y);
  }

  // b2Math.as:82-87
  public static b2Distance(a: b2Vec2, b: b2Vec2): number {
    const cX: number = a.x - b.x;
    const cY: number = a.y - b.y;
    return Math.sqrt(cX * cX + cY * cY);
  }

  // b2Math.as:89-94
  public static b2DistanceSquared(a: b2Vec2, b: b2Vec2): number {
    const cX: number = a.x - b.x;
    const cY: number = a.y - b.y;
    return cX * cX + cY * cY;
  }

  // b2Math.as:96-99
  public static MulFV(s: number, a: b2Vec2): b2Vec2 {
    return new b2Vec2(s * a.x, s * a.y);
  }

  // b2Math.as:101-104
  public static AddMM(A: b2Mat22, B: b2Mat22): b2Mat22 {
    return new b2Mat22(0, b2Math.AddVV(A.col1, B.col1), b2Math.AddVV(A.col2, B.col2));
  }

  // b2Math.as:106-109
  public static b2MulMM(A: b2Mat22, B: b2Mat22): b2Mat22 {
    return new b2Mat22(0, b2Math.b2MulMV(A, B.col1), b2Math.b2MulMV(A, B.col2));
  }

  // b2Math.as:111-116
  public static b2MulTMM(A: b2Mat22, B: b2Mat22): b2Mat22 {
    const c1: b2Vec2 = new b2Vec2(b2Math.b2Dot(A.col1, B.col1), b2Math.b2Dot(A.col2, B.col1));
    const c2: b2Vec2 = new b2Vec2(b2Math.b2Dot(A.col1, B.col2), b2Math.b2Dot(A.col2, B.col2));
    return new b2Mat22(0, c1, c2);
  }

  // b2Math.as:118-121
  public static b2Abs(a: number): number {
    return a > 0 ? a : -a;
  }

  // b2Math.as:123-126
  public static b2AbsV(a: b2Vec2): b2Vec2 {
    return new b2Vec2(b2Math.b2Abs(a.x), b2Math.b2Abs(a.y));
  }

  // b2Math.as:128-131
  public static b2AbsM(A: b2Mat22): b2Mat22 {
    return new b2Mat22(0, b2Math.b2AbsV(A.col1), b2Math.b2AbsV(A.col2));
  }

  // b2Math.as:133-136
  public static b2Min(a: number, b: number): number {
    return a < b ? a : b;
  }

  // b2Math.as:138-141
  public static b2MinV(a: b2Vec2, b: b2Vec2): b2Vec2 {
    return new b2Vec2(b2Math.b2Min(a.x, b.x), b2Math.b2Min(a.y, b.y));
  }

  // b2Math.as:143-146
  public static b2Max(a: number, b: number): number {
    return a > b ? a : b;
  }

  // b2Math.as:148-151
  public static b2MaxV(a: b2Vec2, b: b2Vec2): b2Vec2 {
    return new b2Vec2(b2Math.b2Max(a.x, b.x), b2Math.b2Max(a.y, b.y));
  }

  // b2Math.as:153-156
  public static b2Clamp(a: number, low: number, high: number): number {
    return b2Math.b2Max(low, b2Math.b2Min(a, high));
  }

  // b2Math.as:158-161
  public static b2ClampV(a: b2Vec2, low: b2Vec2, high: b2Vec2): b2Vec2 {
    return b2Math.b2MaxV(low, b2Math.b2MinV(a, high));
  }

  // b2Math.as:163-168
  public static b2Swap(a: unknown[], b: unknown[]): void {
    const tmp: unknown = a[0];
    a[0] = b[0];
    b[0] = tmp;
  }

  // b2Math.as:170-173 — NOT for sim use (non-deterministic).
  public static b2Random(): number {
    return Math.random() * 2 - 1;
  }

  // b2Math.as:175-179 — NOT for sim use (non-deterministic).
  public static b2RandomRange(lo: number, hi: number): number {
    const r: number = Math.random();
    return (hi - lo) * r + lo;
  }

  // b2Math.as:181-189
  public static b2NextPowerOfTwo(x: number): number {
    x |= (x >> 1) & 0x7fffffff;
    x |= (x >> 2) & 0x3fffffff;
    x |= (x >> 4) & 0x0fffffff;
    x |= (x >> 8) & 0xffffff;
    x |= (x >> 16) & 0xffff;
    return x + 1;
  }

  // b2Math.as:191-194
  public static b2IsPowerOfTwo(x: number): boolean {
    return x > 0 && (x & (x - 1)) === 0;
  }
}
