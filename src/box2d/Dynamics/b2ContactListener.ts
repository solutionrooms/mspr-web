// Port of Box2D/Dynamics/b2ContactListener.as (Box2DFlash 2.0.2). The base methods
// are empty no-ops; the game subclasses and overrides them. Parameter types are
// b2ContactPoint / b2ContactResult in the original — typed `unknown` here until those
// data classes are ported (m2). Behaviour (empty base) is faithful regardless, and
// the freefall goldens set no listener anyway.
export class b2ContactListener {
  public Add(_point: unknown): void {}
  public Persist(_point: unknown): void {}
  public Remove(_point: unknown): void {}
  public Result(_result: unknown): void {}
}
