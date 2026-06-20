// Bit-exact comparison helpers. The whole project gates on raw IEEE-754 bits,
// NEVER floats — a 1-ULP divergence is invisible to toBeCloseTo but it is exactly
// the signal that says "your math diverged here, one operation back."

const _buf = new ArrayBuffer(8);
const _dv = new DataView(_buf);

/** Raw IEEE-754 bits of a double as 16 contiguous lowercase-hex chars (hi word
 *  then lo word, big-endian). Matches the AS3 harness `bits()` exactly. */
export function f64hex(x: number): string {
  _dv.setFloat64(0, x, false);
  const hi = _dv.getUint32(0, false);
  const lo = _dv.getUint32(4, false);
  return hi.toString(16).padStart(8, "0") + lo.toString(16).padStart(8, "0");
}

/** Normalize a golden hex token (defensive: lowercase, strip a hi:lo colon). */
export function norm(hex: string): string {
  return hex.toLowerCase().replace(":", "");
}

export interface GoldenRow {
  step: number;
  fields: string[]; // [px, py, a, vx, vy, w] as hex16
}

export interface Golden {
  meta: { fields: string[]; [k: string]: unknown };
  golden: Record<string, GoldenRow[]>;
}
