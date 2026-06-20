// Tiny shape-constructor registry to break the ESM init cycle b2Shape <-> its
// subclasses (b2CircleShape/b2PolygonShape `extends b2Shape`, while b2Shape.Create
// instantiates them). Type-only imports here = no runtime cycle. The subclasses
// register themselves at module load; b2Shape.Create dispatches through this map —
// behaviourally identical to the AS3 `switch(def.type)` factory (b2Shape.as:71-82).
import type { b2Shape } from "./b2Shape";
import type { b2ShapeDef } from "./b2ShapeDef";

type ShapeCtor = (def: b2ShapeDef) => b2Shape;
const registry = new Map<number, ShapeCtor>();

export function registerShapeCtor(type: number, ctor: ShapeCtor): void {
  registry.set(type, ctor);
}

export function createShapeByType(type: number, def: b2ShapeDef): b2Shape | null {
  const ctor = registry.get(type);
  return ctor ? ctor(def) : null;
}
