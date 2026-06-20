// Render the spike reference SWF (harness-spike.as injected as Preloader) under
// Ruffle headless and screenshot the 640x480 stage -> out/ruffle.png.
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const ruffleDir = join(repoRoot, "node_modules", "@ruffle-rs", "ruffle");
const outDir = join(__dirname, "out");
mkdirSync(outDir, { recursive: true });
const swfPath = join(outDir, "spike-ref.swf");
if (!existsSync(swfPath)) { console.error("missing spike-ref.swf — build it first"); process.exit(2); }

const MIME = { ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".map": "application/json", ".html": "text/html", ".swf": "application/x-shockwave-flash" };

const PLAYER_HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#000}#wrap{width:640px;height:480px}</style></head>
<body>
<div id="wrap"></div>
<script src="/ruffle/ruffle.js"></script>
<script>
  window.addEventListener("DOMContentLoaded", function () {
    var ruffle = window.RufflePlayer.newest();
    var player = ruffle.createPlayer();
    player.style.width = "640px";
    player.style.height = "480px";
    document.getElementById("wrap").appendChild(player);
    player.load({
      url: "/movie.swf", autoplay: "on", unmuteOverlay: "hidden", logLevel: "info",
      warnOnUnsupportedContent: false, allowScriptAccess: true, contextMenu: false,
software: "off", scale: "exactFit", forceScale: true, quality: "high",
    }).catch(function (e) { console.log("[CAPTURE_LOAD_ERR] " + e); });
  });
</script>
</body></html>`;

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  try {
    if (url === "/" || url === "/player.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(PLAYER_HTML); return; }
    if (url === "/movie.swf") { res.writeHead(200, { "content-type": MIME[".swf"] }); res.end(readFileSync(swfPath)); return; }
    if (url.startsWith("/ruffle/")) {
      const file = join(ruffleDir, url.slice("/ruffle/".length));
      if (existsSync(file)) { res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }); res.end(readFileSync(file)); return; }
    }
    res.writeHead(404); res.end("not found");
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;
console.log(`[run-ruffle] serving ${swfPath} at ${base}`);

const browser = await puppeteer.launch({
  headless: "shell",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 480, deviceScaleFactor: 1 });

let readyResolve;
const ready = new Promise((r) => (readyResolve = r));
page.on("console", (msg) => {
  const t = msg.text();
  if (t.includes("[READY]")) { console.log("[run-ruffle] harness READY"); readyResolve(); }
  else if (t.includes("[ERR]") || t.includes("[CAPTURE_LOAD_ERR]")) console.error("[run-ruffle] " + t);
});
page.on("pageerror", (e) => console.error("[run-ruffle] pageerror", e));

await page.goto(base, { waitUntil: "domcontentloaded" });
const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("no [READY] in 30s")), 30000));
try { await Promise.race([ready, timeout]); }
catch (e) { console.error("[run-ruffle] " + e.message); await browser.close(); server.close(); process.exit(1); }

// let Ruffle composite a couple of frames before grabbing
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: join(outDir, "ruffle.png"), clip: { x: 0, y: 0, width: 640, height: 480 } });
console.log("[run-ruffle] wrote", join(outDir, "ruffle.png"));

await browser.close();
server.close();
