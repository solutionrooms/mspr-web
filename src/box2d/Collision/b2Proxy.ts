// Port of Box2D/Collision/b2Proxy.as (Box2DFlash 2.0.2), verbatim.
// SAP proxy: lowerBounds/upperBounds index into the bound arrays per axis. The free
// list reuses lowerBounds[0] as the "next free" link (GetNext/SetNext). uint fields.
import { b2BroadPhase } from "./b2BroadPhase";

export class b2Proxy {
  public lowerBounds: number[] = [0, 0];
  public upperBounds: number[] = [0, 0];
  // AS3 uint fields default to 0.
  public overlapCount: number = 0;
  public timeStamp: number = 0;
  public userData: unknown = null;

  // b2Proxy.as:13-15
  public GetNext(): number {
    return this.lowerBounds[0];
  }
  // b2Proxy.as:17-19
  public SetNext(next: number): void {
    this.lowerBounds[0] = next & 0xffff;
  }
  // b2Proxy.as:21-23
  public IsValid(): boolean {
    return this.overlapCount !== b2BroadPhase.b2_invalid;
  }
}
