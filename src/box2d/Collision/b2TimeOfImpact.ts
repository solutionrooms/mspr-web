// Port of Box2D/Collision/b2TimeOfImpact.as (Box2DFlash 2.0.2), line-by-line.
// Conservative advancement: marches a time-of-impact estimate forward using GJK
// distance (b2Distance) and a bound on the relative approach speed. Each iteration
// rebuilds both bodies' transforms from their b2Sweep at the interpolated time
// (b2Sweep.GetXForm → b2Mat22.Set → cos/sin) — THE TOI sub-step trig surface
// (CLAUDE.md rule 5). Op order preserved exactly.
import { b2Settings } from "../Common/b2Settings";
import { b2Vec2 } from "../Common/Math/b2Vec2";
import { b2XForm } from "../Common/Math/b2XForm";
import { b2Distance } from "./b2Distance";
import type { b2Shape } from "./Shapes/b2Shape";
import type { b2Sweep } from "../Common/Math/b2Sweep";

export class b2TimeOfImpact {
  // b2TimeOfImpact.as:12-18
  public static s_p1: b2Vec2 = new b2Vec2();
  public static s_p2: b2Vec2 = new b2Vec2();
  public static s_xf1: b2XForm = new b2XForm();
  public static s_xf2: b2XForm = new b2XForm();

  // b2TimeOfImpact.as:25-105
  public static TimeOfImpact(shape1: b2Shape, sweep1: b2Sweep, shape2: b2Shape, sweep2: b2Sweep): number {
    const r1: number = shape1.m_sweepRadius;
    const r2: number = shape2.m_sweepRadius;
    const t0: number = sweep1.t0;
    const v1X: number = sweep1.c.x - sweep1.c0.x;
    const v1Y: number = sweep1.c.y - sweep1.c0.y;
    const v2X: number = sweep2.c.x - sweep2.c0.x;
    const v2Y: number = sweep2.c.y - sweep2.c0.y;
    const omega1: number = sweep1.a - sweep1.a0;
    const omega2: number = sweep2.a - sweep2.a0;
    let alpha: number = 0;
    const p1: b2Vec2 = b2TimeOfImpact.s_p1;
    const p2: b2Vec2 = b2TimeOfImpact.s_p2;
    const k_maxIterations: number = 20;
    let iter: number = 0;
    let distance: number = 0;
    let targetDistance: number = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const t: number = (1 - alpha) * t0 + alpha;
      const xf1: b2XForm = b2TimeOfImpact.s_xf1;
      const xf2: b2XForm = b2TimeOfImpact.s_xf2;
      sweep1.GetXForm(xf1, t);
      sweep2.GetXForm(xf2, t);
      distance = b2Distance.Distance(p1, p2, shape1, xf1, shape2, xf2);
      if (iter === 0) {
        if (distance > 2 * b2Settings.b2_toiSlop) {
          targetDistance = 1.5 * b2Settings.b2_toiSlop;
        } else {
          const d1: number = 0.05 * b2Settings.b2_toiSlop;
          const d2: number = distance - 0.5 * b2Settings.b2_toiSlop;
          targetDistance = d1 > d2 ? d1 : d2;
        }
      }
      if (distance - targetDistance < 0.05 * b2Settings.b2_toiSlop || iter === k_maxIterations) {
        break;
      }
      let nX: number = p2.x - p1.x;
      let nY: number = p2.y - p1.y;
      const length: number = Math.sqrt(nX * nX + nY * nY);
      nX /= length;
      nY /= length;
      const approach: number =
        nX * (v1X - v2X) +
        nY * (v1Y - v2Y) +
        (omega1 < 0 ? -omega1 : omega1) * r1 +
        (omega2 < 0 ? -omega2 : omega2) * r2;
      if (approach === 0) {
        alpha = 1;
        break;
      }
      const dAlpha: number = (distance - targetDistance) / approach;
      const newAlpha: number = alpha + dAlpha;
      if (newAlpha < 0 || 1 < newAlpha) {
        alpha = 1;
        break;
      }
      if (newAlpha < (1 + 100 * Number.MIN_VALUE) * alpha) {
        break;
      }
      alpha = newAlpha;
      iter++;
    }
    return alpha;
  }
}
