// Port of Box2D/Collision/b2Bound.as (Box2DFlash 2.0.2), verbatim.
// SAP bound endpoint: quantized integer `value` (low bit = lower/upper), proxyId,
// stabbingCount. All uint.
export class b2Bound {
  // AS3 uint fields default to 0.
  public value: number = 0;
  public proxyId: number = 0;
  public stabbingCount: number = 0;

  // b2Bound.as:13-15
  public IsLower(): boolean {
    return (this.value & 1) === 0;
  }
  // b2Bound.as:17-19
  public IsUpper(): boolean {
    return (this.value & 1) === 1;
  }
  // b2Bound.as:21-32
  public Swap(b: b2Bound): void {
    const value: number = this.value;
    const proxyId: number = this.proxyId;
    const stabbingCount: number = this.stabbingCount;
    this.value = b.value;
    this.proxyId = b.proxyId;
    this.stabbingCount = b.stabbingCount;
    b.value = value;
    b.proxyId = proxyId;
    b.stabbingCount = stabbingCount;
  }
}
