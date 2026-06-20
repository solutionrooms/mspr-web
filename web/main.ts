// Live demo: the REAL bit-exact Box2DFlash 2.0.2 TypeScript port (src/box2d) running
// in the browser — now exercising the m4 sequential-impulse SOLVER (landed + bit-exact-
// gated). Boxes drop into a bin and stack/settle with real friction + restitution. This
// uses exactly the m4-validated path: doSleep OFF (sleep is m5), continuousPhysics OFF
// (TOI is m7). Cosmetic shapes only — zero copyrighted game art.
import { b2World } from "../src/box2d/Dynamics/b2World";
import { b2AABB } from "../src/box2d/Collision/b2AABB";
import { b2Vec2 } from "../src/box2d/Common/Math/b2Vec2";
import { b2BodyDef } from "../src/box2d/Dynamics/b2BodyDef";
import { b2PolygonDef } from "../src/box2d/Collision/Shapes/b2PolygonDef";
import type { b2Body } from "../src/box2d/Dynamics/b2Body";

const PHYS_STEP = 1 / 80;
const ITERS = 10;
const MAX_BOXES = 130;

// World — mspr config, but doSleep=false + continuousPhysics=false (the m4 solver path).
const aabb = new b2AABB();
aabb.lowerBound.Set(-25000, -25000);
aabb.upperBound.Set(25000, 25000);
const world = new b2World(aabb, new b2Vec2(0, 20), false);
world.SetContinuousPhysics(false);

// Fixed world-space bin (independent of screen; the view scales to fit it).
const FLOOR_Y = 26;
const WALL_X = 16;
const TOP_Y = 0;

function staticBox(cx: number, cy: number, hx: number, hy: number): void {
  const bd = new b2BodyDef();
  bd.position.Set(cx, cy);
  const b = world.CreateBody(bd)!;
  const sd = new b2PolygonDef();
  sd.SetAsBox(hx, hy);
  sd.friction = 0.6;
  sd.restitution = 0.1;
  b.CreateShape(sd);
}
staticBox(0, FLOOR_Y + 0.5, WALL_X + 1, 0.5); // floor
staticBox(-WALL_X - 0.5, FLOOR_Y / 2, 0.5, FLOOR_Y / 2 + 2); // left wall
staticBox(WALL_X + 0.5, FLOOR_Y / 2, 0.5, FLOOR_Y / 2 + 2); // right wall

interface Box {
  body: b2Body;
  color: string;
}
const boxes: Box[] = [];
const COLORS = ["#e23b3b", "#2b6cd4", "#19a974", "#ffd23f", "#9b59b6", "#ff7f2a", "#16a2b8", "#ec407a"];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
let spawned = 0;

function spawnBox(): void {
  if (boxes.length >= MAX_BOXES) {
    const old = boxes.shift()!; // recycle the oldest to keep the bin flowing
    world.DestroyBody(old.body);
  }
  const bd = new b2BodyDef();
  bd.position.Set(rand(-WALL_X + 2, WALL_X - 2), TOP_Y);
  const body = world.CreateBody(bd)!;
  const sd = new b2PolygonDef();
  sd.SetAsBox(0.7, 0.7);
  sd.density = 0.5;
  sd.friction = 0.5;
  sd.restitution = 0.1;
  body.CreateShape(sd);
  body.SetMassFromShapes();
  body.SetLinearVelocity(new b2Vec2(rand(-3, 3), rand(2, 5)));
  body.SetAngularVelocity(rand(-4, 4));
  boxes.push({ body, color: COLORS[spawned % COLORS.length] });
  spawned++;
}

// ---- view ----
const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
let W = 0, H = 0, SCALE = 20, ox = 0, oy = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  SCALE = Math.min(W / (2 * WALL_X + 6), H / (FLOOR_Y + 6)); // fit the bin
  ox = W / 2;
  oy = (H - (FLOOR_Y + 2) * SCALE) / 2 + 1 * SCALE;
}
window.addEventListener("resize", resize);
resize();

const sx = (wx: number) => ox + wx * SCALE;
const sy = (wy: number) => oy + wy * SCALE;

function drawBox(body: b2Body, hx: number, hy: number, fill: string, stroke: string) {
  const p = body.GetPosition();
  ctx.save();
  ctx.translate(sx(p.x), sy(p.y));
  ctx.rotate(body.GetAngle());
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-hx * SCALE, -hy * SCALE, hx * 2 * SCALE, hy * 2 * SCALE);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

let frames = 0, steps = 0, fps = 0, lastT = performance.now(), acc = 0, sinceSpawn = 0;

function frame(t: number) {
  // Drip-feed boxes in.
  if (++sinceSpawn >= 5) {
    spawnBox();
    sinceSpawn = 0;
  }
  // Fixed cadence: 2× Step per displayed frame (the game's 2×(1/80) loop).
  world.Step(PHYS_STEP, ITERS);
  world.Step(PHYS_STEP, ITERS);
  steps += 2;

  ctx.fillStyle = "#fffdf5";
  ctx.fillRect(0, 0, W, H);

  // bin
  ctx.fillStyle = "#cdbfa6";
  ctx.fillRect(sx(-WALL_X - 1), sy(FLOOR_Y), (2 * WALL_X + 2) * SCALE, SCALE);
  ctx.fillRect(sx(-WALL_X - 1), sy(0), SCALE, FLOOR_Y * SCALE);
  ctx.fillRect(sx(WALL_X), sy(0), SCALE, FLOOR_Y * SCALE);

  for (const b of boxes) drawBox(b.body, 0.7, 0.7, b.color, "rgba(26,26,26,0.85)");

  frames++;
  acc += t - lastT;
  lastT = t;
  if (acc >= 500) {
    fps = Math.round((frames * 1000) / acc);
    frames = 0;
    acc = 0;
    const hud = document.getElementById("hud");
    if (hud) hud.textContent = `m4 solver: live · ${boxes.length} boxes · ${steps.toLocaleString()} sim steps · ${fps} fps`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
