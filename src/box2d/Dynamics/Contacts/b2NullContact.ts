// Port of Box2D/Dynamics/Contacts/b2NullContact.as (Box2DFlash 2.0.2), verbatim.
// Returned by b2ContactManager.PairAdded for pairs that must not generate a real contact
// (both static, same body, jointed-non-colliding, filtered out).
import { b2Contact } from "./b2Contact";
import type { b2Manifold } from "../../Collision/b2Manifold";
import type { b2ContactListener } from "../b2ContactListener";

export class b2NullContact extends b2Contact {
  // b2NullContact.as:8-11
  constructor() {
    super();
  }
  // b2NullContact.as:13-15
  public override Evaluate(_listener: b2ContactListener | null): void {}
  // b2NullContact.as:17-19
  public override GetManifolds(): b2Manifold[] | null {
    return null;
  }
}
