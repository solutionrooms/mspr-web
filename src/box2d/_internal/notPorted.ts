// Marks a code path that is intentionally NOT yet ported, because it belongs to a
// later milestone (collision m2/m3, solver m4, sleeping m5, joints m6, CCD/TOI m7).
// The freefall goldens (m0/m1) never reach these paths — a shapeless, jointless,
// contactless body. If one of these throws, a milestone boundary was crossed early
// and the port must be advanced faithfully (never stubbed to pass).
export function notPorted(what: string): never {
  throw new Error(
    `[box2d port] not yet ported: ${what}. This path belongs to a later milestone; ` +
      `port it line-by-line from the .as before exercising it.`,
  );
}
