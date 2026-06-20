// Contact-type registration table — breaks the ESM init cycle b2Contact <-> its
// subclasses (b2CircleContact/etc. `extends b2Contact`, while b2Contact.InitializeRegisters
// references the subclass Create/Destroy fns). Type-only imports here = no runtime cycle.
// The subclasses register themselves at module load; b2Contact.InitializeRegisters then
// feeds these into AddType — behaviourally identical to the AS3 InitializeRegisters
// (b2Contact.as:90-109), which calls AddType once per shape-type pair.
import type { ContactCreateFcn, ContactDestroyFcn } from "./b2ContactRegister";

export interface ContactTypeRegistration {
  type1: number;
  type2: number;
  createFcn: ContactCreateFcn;
  destroyFcn: ContactDestroyFcn;
}

const registrations: ContactTypeRegistration[] = [];

export function registerContactType(reg: ContactTypeRegistration): void {
  registrations.push(reg);
}

export function getContactTypeRegistrations(): ContactTypeRegistration[] {
  return registrations;
}
