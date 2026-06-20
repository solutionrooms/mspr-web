// Port of Box2D/Collision/b2Pair.as (Box2DFlash 2.0.2), verbatim.
// uint fields; status bit-flags. b2_nullProxy/b2_nullPair = USHRT_MAX (65535).
import { b2Settings } from "../Common/b2Settings";

export class b2Pair {
  public static b2_nullPair: number = b2Settings.USHRT_MAX;
  public static b2_nullProxy: number = b2Settings.USHRT_MAX;
  public static b2_tableCapacity: number = b2Settings.b2_maxPairs;
  public static b2_tableMask: number = b2Pair.b2_tableCapacity - 1;
  public static e_pairBuffered: number = 1;
  public static e_pairRemoved: number = 2;
  public static e_pairFinal: number = 4;

  public userData: unknown = null;
  // AS3 uint fields default to 0.
  public proxyId1: number = 0;
  public proxyId2: number = 0;
  public next: number = 0;
  public status: number = 0;

  public SetBuffered(): void {
    this.status |= b2Pair.e_pairBuffered;
  }
  public ClearBuffered(): void {
    this.status &= ~b2Pair.e_pairBuffered;
  }
  public IsBuffered(): boolean {
    return (this.status & b2Pair.e_pairBuffered) === b2Pair.e_pairBuffered;
  }
  public SetRemoved(): void {
    this.status |= b2Pair.e_pairRemoved;
  }
  public ClearRemoved(): void {
    this.status &= ~b2Pair.e_pairRemoved;
  }
  public IsRemoved(): boolean {
    return (this.status & b2Pair.e_pairRemoved) === b2Pair.e_pairRemoved;
  }
  public SetFinal(): void {
    this.status |= b2Pair.e_pairFinal;
  }
  public IsFinal(): boolean {
    return (this.status & b2Pair.e_pairFinal) === b2Pair.e_pairFinal;
  }
}
