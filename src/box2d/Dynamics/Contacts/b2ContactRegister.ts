// Port of Box2D/Dynamics/Contacts/b2ContactRegister.as (Box2DFlash 2.0.2), verbatim.
import type { b2Shape } from "../../Collision/Shapes/b2Shape";
import type { b2Contact } from "./b2Contact";

export type ContactCreateFcn = (shape1: b2Shape, shape2: b2Shape, allocator: unknown) => b2Contact;
export type ContactDestroyFcn = (contact: b2Contact, allocator: unknown) => void;

export class b2ContactRegister {
  public createFcn: ContactCreateFcn | null = null;
  public destroyFcn: ContactDestroyFcn | null = null;
  public primary: boolean = false;
}
