/**
 * mspr game-data contract — types for the JSON in data/ (produced by tools/extract_data.py).
 * Owner: game developer. Consumed by the TS level/library loader (and indirectly engine + render).
 *
 * RAW-STRING DISCIPLINE (important — the Prime Directive applies to physics inputs)
 *   Every value below is the VERBATIM attribute string from the SWF XML. The extractor
 *   does NOT convert numbers. The loader must apply the EXACT conversions the AS3 used
 *   so loaded values are bit-identical to the original game. Decoders to port (cite the
 *   .as line range above each, as usual):
 *     - XmlHelper.GetAttrString / GetAttrInt / GetAttrNumber     (attribute defaults)
 *     - ObjectParameters.* over the `params="k=v,k=v"` CSV       (block/obj/joint params)
 *     - Utils.* for CSV number/point arrays                       (speed, markers, vars array)
 *     - Vars.DecodeXML → number/int/array typing                 (Vars.as)
 *   Material → Box2D fixture: density/friction/restitution (Number); see PhysicsBase.AddPhysObjAt.
 */

// ---------- data/constants.json ----------
export type Constants = Record<string, string>;

// ---------- data/materials.json (Box2D physics materials) ----------
export interface Material { density: string; friction: string; restitution: string }
export type Materials = Record<string, Material>;

// ---------- data/objparams.json (editor parameter schema) ----------
export interface ObjParam { name: string; type: string; default: string }

// ---------- data/colors.json (top-level palette, 6-hex strings) ----------
export type Palette = string[];

// ---------- data/vars.json (flat tuning table; type ∈ number|int|array|...) ----------
export interface Var { name: string; type: string; value: string }
export type Vars = Var[];

// ---------- data/physobjs.json (physics object library) ----------
export interface GraphicRef { clip: string; frame?: string; pos?: string; rot?: string; scale?: string; zoffset?: string }
export interface CollisionRef { type: string; points?: string }
export interface PhysObjDef {
  name: string;
  hasphysics?: string;      // 'true' → has bodies/collision
  inlibrary?: string;
  initfunction?: string;    // AS3 init function name → registry key in the TS behavior port
  graphics: GraphicRef[];
  collisions: CollisionRef[];
  bodies: Record<string, string>[];   // present on some defs; raw attrs
}

// ---------- data/aicars.json ----------
export interface AiCar { name: string; mc: string; scale: string; speed: string; colors: string[] }
export interface AiCarGroup { name: string; cars: string[] }
export interface AiCars { cars: AiCar[]; groups: AiCarGroup[] }

// ---------- data/levels.json (8 canonical levels) ----------
/** A track = an ordered list of typed blocks along Z, plus checkpoint objs. */
export interface RoadBlock {
  btype: string;            // bend | abshill | width | surface | edge | billboard |
                            // weather | aizone | solidedge | label | levelinfo
  id: string;
  z: string;                // start distance along track
  dist: string;             // length of effect
  active: string;
  params: string;           // "k=v,k=v" — ObjectParameters
}
export interface RoadObj {
  columnid: string;
  id: string;
  type: string;             // obj_checkpoint_start | obj_checkpoint_end | ...
  x: string; z: string; rot: string; scale: string;
  params: string;
}
export interface LevelRoad { randseed: string; blocks: RoadBlock[]; objs: RoadObj[] }
export interface HeatRush { gold: string; silver: string; bronze: string }
export interface LevelMap {
  minx: string; maxx: string; miny: string; maxy: string;
  cellw: string; cellh: string;
  mapdata: string[];
}
export interface Level {
  id: string;
  name: string;
  displayname: string;
  category: string;
  desc?: string;
  bg: string;
  heatrush: HeatRush | null;   // medal target times (seconds)
  road: LevelRoad | null;
  joints: Record<string, string>[];
  map: LevelMap | null;
}
export type Levels = Level[];

// ---------- data/roaddata.json (road-asset library referenced by level blocks) ----------
export interface RoadChild { tag: string; [attr: string]: string }
// Raw attrs (strings) plus the generic nested-element capture from extract_data.py.
// The index signature must admit `undefined` so the optional `_children` is assignable.
export interface RoadDef { _children?: RoadChild[]; [attr: string]: string | RoadChild[] | undefined }
export interface RoadData {
  billboards: RoadDef[];
  billboardgroups: RoadDef[];
  roadsurfaces: RoadDef[];
  edgesegments: RoadDef[];
  physicalsurfaces: RoadDef[];   // name, dust, topspeedmod, accelmod (grip/speed per surface)
  objectcolumns: RoadDef[];
  posmarkers: Record<string, string>[];
}

// ---------- data/achievements.json ----------
export interface Achievement {
  specificlevel: string;
  name: string;
  desc?: string;
  tounlock: string;
  idnetid: string;
  specifics?: string;
  tests: { func: string; params?: string }[];
  pass: { func: string; params?: string }[];
}

// ---------- data/caroffsets.json (ExportedBitmapsData — car sprite pivots) ----------
export interface CarOffset {
  mcname: string; mcframe: string;
  xoff: string; width: string; xoffxf: string; yoff: string;
  markers?: string;          // "x,y,x,y,..." → Vector.<Point>
}

// ---------- data/textstrings.json (i18n; one attr per language code) ----------
export interface TextString { name: string; [lang: string]: string }
