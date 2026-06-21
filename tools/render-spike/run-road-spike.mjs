// Render the level-0 road (P3) in headless Chrome and screenshot -> out/road.png.
// Bundles road-spike-main.ts (esbuild), serves it + data/ + road textures, grabs the canvas.
// Usage: node tools/render-spike/run-road-spike.mjs [z] [y] [x]
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import puppeteer from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const roadAssets = join(repoRoot, "src", "render", "assets", "road");
const dataDir = join(repoRoot, "data");
const outDir = join(__dirname, "out");
mkdirSync(outDir, { recursive: true });

const z = process.argv[2] ?? "1600", y = process.argv[3] ?? "150", x = process.argv[4] ?? "0";

const bundle = await build({ entryPoints: [join(__dirname, "road-spike-main.ts")], bundle: true, format: "iife", write: false, target: "es2020", logLevel: "warning" });
const js = bundle.outputFiles[0].text;
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#000">
<canvas id="gl" width="640" height="480"></canvas><script>${js}</script></body></html>`;

const MIME = { ".json": "application/json", ".png": "image/png", ".html": "text/html" };
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  try {
    if (url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(HTML); return; }
    if (url.startsWith("/data/")) { const f = join(dataDir, url.slice("/data/".length)); if (existsSync(f)) { res.writeHead(200, { "content-type": MIME[extname(f)] ?? "application/octet-stream" }); res.end(readFileSync(f)); return; } }
    if (url.startsWith("/assets/road/")) { const f = join(roadAssets, url.slice("/assets/road/".length)); if (existsSync(f)) { res.writeHead(200, { "content-type": MIME[extname(f)] ?? "application/octet-stream" }); res.end(readFileSync(f)); return; } }
    res.writeHead(404); res.end("not found");
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await puppeteer.launch({ headless: "shell", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.error("[pageerror]", e));
await page.goto(`http://127.0.0.1:${port}/?z=${z}&y=${y}&x=${x}`, { waitUntil: "domcontentloaded" });
try { await page.waitForFunction(() => window.__done === true || window.__error, { timeout: 30000 }); }
catch { console.error("[run-road-spike] timed out"); }
const err = await page.evaluate(() => window.__error);
if (err) { console.error("[run-road-spike] page error:\n" + err); await browser.close(); server.close(); process.exit(1); }
const dataUrl = await page.evaluate(() => window.__pngDataURL);
writeFileSync(join(outDir, "road.png"), Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
console.log("[run-road-spike] wrote", join(outDir, "road.png"));
await browser.close();
server.close();
