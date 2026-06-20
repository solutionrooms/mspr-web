// Render the spike scene with the WebGL2 compositor in headless Chrome.
// Bundles spike-main.ts with esbuild, serves it + atlas + scene, screenshots the
// canvas -> tools/render-spike/out/webgl.png.
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import puppeteer from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const assetsDir = join(repoRoot, "src", "render", "assets");
const outDir = join(__dirname, "out");
mkdirSync(outDir, { recursive: true });

// 1. bundle the TS spike entry
const bundle = await build({
  entryPoints: [join(__dirname, "spike-main.ts")],
  bundle: true,
  format: "iife",
  write: false,
  target: "es2020",
  logLevel: "warning",
});
const js = bundle.outputFiles[0].text;

const HTML = `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#000">
<canvas id="gl" width="640" height="480"></canvas>
<script>${js}</script>
</body></html>`;

const MIME = { ".json": "application/json", ".png": "image/png", ".html": "text/html" };
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  try {
    if (url === "/" ) { res.writeHead(200, { "content-type": "text/html" }); res.end(HTML); return; }
    if (url === "/scene.json") { res.writeHead(200, { "content-type": MIME[".json"] }); res.end(readFileSync(join(__dirname, "scene.json"))); return; }
    if (url.startsWith("/assets/")) {
      const f = join(assetsDir, url.slice("/assets/".length));
      if (existsSync(f)) { res.writeHead(200, { "content-type": MIME[extname(f)] ?? "application/octet-stream" }); res.end(readFileSync(f)); return; }
    }
    res.writeHead(404); res.end("not found");
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;

const browser = await puppeteer.launch({
  headless: "shell",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.error("[pageerror]", e));
await page.goto(base, { waitUntil: "domcontentloaded" });

try {
  await page.waitForFunction(() => window.__done === true || window.__error, { timeout: 30000 });
} catch (e) {
  console.error("[run-webgl] timed out waiting for render");
}
const err = await page.evaluate(() => window.__error);
if (err) { console.error("[run-webgl] page error:\n" + err); await browser.close(); server.close(); process.exit(1); }

const dataUrl = await page.evaluate(() => window.__pngDataURL);
const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
writeFileSync(join(outDir, "webgl.png"), Buffer.from(b64, "base64"));
console.log("[run-webgl] wrote", join(outDir, "webgl.png"));

await browser.close();
server.close();
