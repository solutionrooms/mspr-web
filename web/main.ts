// Live demo: the REAL bit-exact Box2DFlash 2.0.2 TypeScript port (src/box2d),
// running in the browser. A fountain of shapeless bodies flung up with spin and
// integrated under mspr's exact world config — this is the m0/m1 path the golden
// hex16 tests gate (freefall + rotation), so it uses ZERO unported engine code
// and ZERO copyrighted game art. The shapes drawn are cosmetic; the motion
// (parabolic arcs + constant spin) is straight from the ported integrator.
import { b2World } from "../src/box2d/Dynamics/b2World";
import { b2AABB } from "../src/box2d/Collision/b2AABB";
import { b2Vec2 } from "../src/box2d/Common/Math/b2Vec2";
import { b2BodyDef } from "../src/box2d/Dynamics/b2BodyDef";
import type { b2Body } from "../src/box2d/Dynamics/b2Body";

const PHYS_STEP = 1 / 80; // physStep  (PhysicsBase.as — mspr config)
const ITERS = 10; // physNumIterations
const SCALE = 15; // world units → screen px
const N = 80; // body count

// World setup mirrors PhysicsBase.InitBox2D / the m0-m1 test exactly.
function makeWorld(): b2World {
  const aabb = new b2AABB();
  aabb.lowerBound.Set(-25000, -25000);
  aabb.upperBound.Set(25000, 25000);
  return new b2World(aabb, new b2Vec2(0, 20), true); // gravity (0,20), allowSleep
}
const world = makeWorld();

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
let W = 0,
  H = 0,
  ox = 0,
  oy = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ox = W / 2; // world origin on screen
  oy = H / 2;
}
window.addEventListener("resize", resize);
resize();

const COLORS = ["#e23b3b", "#2b6cd4", "#19a974", "#ffd23f", "#9b59b6", "#ff7f2a", "#16a2b8", "#ec407a"];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Sprite {
  body: b2Body;
  color: string;
  sides: number;
  r: number;
}
const sprites: Sprite[] = [];

// (re)launch a body from the bottom, flung upward (−y) with sideways drift + spin.
function launch(b: b2Body) {
  const wx = rand(-W * 0.32, W * 0.32) / SCALE;
  const wy = (H * 0.5 + rand(20, 90)) / SCALE; // just below the screen (world +y is down)
  b.SetXForm(new b2Vec2(wx, wy), rand(0, Math.PI * 2));
  b.SetLinearVelocity(new b2Vec2(rand(-10, 10), rand(-30, -22))); // up + drift
  b.SetAngularVelocity(rand(-7, 7));
}

for (let i = 0; i < N; i++) {
  const bd = new b2BodyDef();
  bd.massData.mass = 1;
  bd.massData.I = 1;
  const body = world.CreateBody(bd)!;
  launch(body);
  sprites.push({ body, color: COLORS[i % COLORS.length], sides: 3 + (i % 5), r: rand(7, 16) });
}

function drawShape(x: number, y: number, a: number, sides: number, r: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  for (let k = 0; k < sides; k++) {
    const ang = (k / sides) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(ang) * r,
      py = Math.sin(ang) * r;
    k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(26,26,26,0.85)";
  ctx.stroke();
  ctx.restore();
}

let frames = 0,
  steps = 0,
  fps = 0,
  lastT = performance.now(),
  acc = 0;

function frame(t: number) {
  // Fixed cadence: 2× Step per displayed frame (the game's 2×(1/80) loop).
  world.Step(PHYS_STEP, ITERS);
  world.Step(PHYS_STEP, ITERS);
  steps += 2;

  ctx.fillStyle = "#fffdf5";
  ctx.fillRect(0, 0, W, H);
  // faint grid (paint-paper)
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= W; gx += 28) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, H);
    ctx.stroke();
  }
  for (let gy = 0; gy <= H; gy += 28) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.stroke();
  }

  for (const s of sprites) {
    const p = s.body.GetPosition();
    const sx = ox + p.x * SCALE;
    const sy = oy + p.y * SCALE;
    if (sy > H + 60 || sx < -80 || sx > W + 80) {
      launch(s.body); // recycle once it leaves the stage
      continue;
    }
    drawShape(sx, sy, s.body.GetAngle(), s.sides, s.r, s.color);
  }

  frames++;
  acc += t - lastT;
  lastT = t;
  if (acc >= 500) {
    fps = Math.round((frames * 1000) / acc);
    frames = 0;
    acc = 0;
    const hud = document.getElementById("hud");
    if (hud) hud.textContent = `engine: live · ${N} bodies · ${steps.toLocaleString()} sim steps · ${fps} fps`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
