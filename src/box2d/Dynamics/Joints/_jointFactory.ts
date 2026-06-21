// Joint-constructor registry — breaks the ESM init cycle b2Joint <-> its subclasses
// (b2RevoluteJoint/etc. `extends b2Joint`, while b2Joint.Create instantiates them).
// Type-only imports here = no runtime cycle. Subclasses register at module load;
// b2Joint.Create dispatches through this map — identical to the AS3 switch(def.type)
// factory (b2Joint.as:67-91).
import type { b2Joint } from "./b2Joint";
import type { b2JointDef } from "./b2JointDef";

type JointCtor = (def: b2JointDef) => b2Joint;
const registry = new Map<number, JointCtor>();

export function registerJointType(type: number, ctor: JointCtor): void {
  registry.set(type, ctor);
}

export function createJointByType(type: number, def: b2JointDef): b2Joint | null {
  const ctor = registry.get(type);
  return ctor ? ctor(def) : null;
}
