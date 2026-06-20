// Port of Box2D/Collision/b2PairCallback.as (Box2DFlash 2.0.2), verbatim.
// Abstract base the broadphase calls when proxy pairs are added/removed.
// b2ContactManager overrides these to drive narrowphase contact lifecycle.
export class b2PairCallback {
  // b2PairCallback.as:10-13
  public PairAdded(_proxyUserData1: unknown, _proxyUserData2: unknown): unknown {
    return null;
  }
  // b2PairCallback.as:15-17
  public PairRemoved(_proxyUserData1: unknown, _proxyUserData2: unknown, _pairUserData: unknown): void {}
}
