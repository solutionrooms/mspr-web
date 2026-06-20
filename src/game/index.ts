// Game-framework public surface (loaders + entity model + loop). The runtime data
// source (read data/*.json via fs in Node, or a JSON import / fetch in the web build)
// is the caller's concern — the loaders are pure (raw JSON → typed) so they stay testable.
export * from "./util/convert";
export * from "./data/materials";
export * from "./data/vars";
export * from "./data/physobjs";
export * from "./data/levels";
export * from "./model/body-user-data";
export * from "./model/game-obj";
export * from "./model/game-objects";
export * from "./physics-base";
export * from "./game";
