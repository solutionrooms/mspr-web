// The bit-exact ARCADE car integrator — mspr's real physics engine (Box2D is vestigial;
// see CLAUDE.md "Box2D is dead in the ship"). Pure `Number` math ported op-for-op from
// GameObj.UpdatePlayer so it is bit-identical to the shipped bytecode by construction
// (AS3 Number == JS number == IEEE-754 double; preserve parenthesisation + evaluation
// order). hex16-gated against a Ruffle golden. ZERO render/Flash deps.
//
// Grows milestone-by-milestone on the a-ladder (a0 coast → a1 throttle → … → a7 ghost).
// This file currently covers a0 (the coast / knocked-out integrator).

/** Minimal arcade car state the integrator reads/writes (subset of GameObj's track-space
 *  fields). The full UpdatePlayer reads more (input, Vars, state machine) as later
 *  milestones land; a0 touches only the longitudinal roll. */
export interface ArcadeCarState {
  zpos: number; // along-track distance
  zvel: number; // along-track velocity
  oldzpos: number; // last tick's zpos (collision history); UpdatePlayer sets it every tick
}

/**
 * a0 — coast / knocked-out roll. The `isKnockedOut` branch of `UpdatePlayer`
 * (GameObj.as:2059-2069): a decelerating roll that clamps to a dead stop. This is the
 * "freefall" of the arcade engine — the smallest self-contained integrator path, no input,
 * no trig, no Vars. The longitudinal state `(zpos, zvel)` evolves entirely from these lines.
 *
 *   GameObj.as:2035  oldzpos = zpos;          // UpdatePlayer preamble, every tick
 *   GameObj.as:2061  zpos += zvel;
 *   GameObj.as:2062  zvel -= 0.1;
 *   GameObj.as:2063  if(zvel < 0)
 *   GameObj.as:2065  zvel = 0;
 *
 * (The shipped branch also calls Player_SetBackgroundPos / EngineVolumeChange afterwards —
 * background + audio side-effects that never touch zpos/zvel, so they are out of the
 * bit-exact longitudinal gate.)
 */
export function updatePlayerCoast(car: ArcadeCarState): void {
  car.oldzpos = car.zpos;
  car.zpos += car.zvel;
  car.zvel -= 0.1;
  if (car.zvel < 0) {
    car.zvel = 0;
  }
}
