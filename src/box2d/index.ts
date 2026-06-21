// Public API of the bit-exact Box2DFlash 2.0.2 TypeScript port.
// Pure-math module — ZERO game/render/Flash dependencies. The game adapts to this
// engine; this engine never bends to a level. Surface grows milestone by milestone;
// see DEVELOPER_MESSAGES.md for the published API + golden-coverage report.

// Common / Math
export { b2Vec2 } from "./Common/Math/b2Vec2";
export { b2Mat22 } from "./Common/Math/b2Mat22";
export { b2XForm } from "./Common/Math/b2XForm";
export { b2Sweep } from "./Common/Math/b2Sweep";
export { b2Math } from "./Common/Math/b2Math";
export { b2Settings } from "./Common/b2Settings";

// Collision
export { b2AABB } from "./Collision/b2AABB";
export { b2FilterData } from "./Collision/Shapes/b2FilterData";
export { b2MassData } from "./Collision/Shapes/b2MassData";

// Dynamics
export { b2World } from "./Dynamics/b2World";
export { b2Body } from "./Dynamics/b2Body";
export { b2BodyDef } from "./Dynamics/b2BodyDef";
export { b2TimeStep } from "./Dynamics/b2TimeStep";
export { b2ContactListener } from "./Dynamics/b2ContactListener";
export { b2ContactFilter } from "./Dynamics/b2ContactFilter";

// Joints (m6) — FZ3 uses revolute/prismatic/distance/mouse; pulley/gear ported for
// completeness. CreateJoint via b2World.CreateJoint(def).
export { b2Joint } from "./Dynamics/Joints/b2Joint";
export { b2JointDef } from "./Dynamics/Joints/b2JointDef";
export { b2RevoluteJoint } from "./Dynamics/Joints/b2RevoluteJoint";
export { b2RevoluteJointDef } from "./Dynamics/Joints/b2RevoluteJointDef";
export { b2PrismaticJoint } from "./Dynamics/Joints/b2PrismaticJoint";
export { b2PrismaticJointDef } from "./Dynamics/Joints/b2PrismaticJointDef";
export { b2DistanceJoint } from "./Dynamics/Joints/b2DistanceJoint";
export { b2DistanceJointDef } from "./Dynamics/Joints/b2DistanceJointDef";
export { b2MouseJoint } from "./Dynamics/Joints/b2MouseJoint";
export { b2MouseJointDef } from "./Dynamics/Joints/b2MouseJointDef";
export { b2PulleyJoint } from "./Dynamics/Joints/b2PulleyJoint";
export { b2PulleyJointDef } from "./Dynamics/Joints/b2PulleyJointDef";
export { b2GearJoint } from "./Dynamics/Joints/b2GearJoint";
export { b2GearJointDef } from "./Dynamics/Joints/b2GearJointDef";
