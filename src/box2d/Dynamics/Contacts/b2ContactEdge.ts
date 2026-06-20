// Port of Box2D/Dynamics/Contacts/b2ContactEdge.as (Box2DFlash 2.0.2), verbatim.
import type { b2Body } from "../b2Body";
import type { b2Contact } from "./b2Contact";

export class b2ContactEdge {
  public other: b2Body | null = null;
  public contact: b2Contact | null = null;
  public prev: b2ContactEdge | null = null;
  public next: b2ContactEdge | null = null;
}
