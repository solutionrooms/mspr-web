// Generic golden capture: run a [TAG]-emitting harness SWF under Ruffle headless
// (puppeteer + the local @ruffle-rs/ruffle build) and scrape every traced line
// until a [DONE] sentinel. Parses the bit-traced fields into a structured golden
// JSON. Nothing here knows about Box2D — it just scrapes tagged trace lines.
// (Lifted verbatim from FZ3's rig — the capture infra is engine-agnostic.)
//
// Usage: node tools/oracle/capture-lines.mjs <movie.swf> <out.json> [--tags M0,M1] [--done DONE] [--timeout 120000]
//
// Trace line format produced by the harness (see harness-*.as):
//   [TAG] <stepIndex> <hex16> <hex16> ...   (each field = 16 hex chars = raw f64)
import http from "node:http";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const ruffleDir = join(repoRoot, "node_modules", "@ruffle-rs", "ruffle");

function parseArgs(argv) {
  const pos = [];
  const opt = { tags: null, done: "DONE", timeout: 120000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tags") opt.tags = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--done") opt.done = argv[++i];
    else if (a === "--timeout") opt.timeout = parseInt(argv[++i], 10);
    else pos.push(a);
  }
  return { pos, opt };
}

const { pos, opt } = parseArgs(process.argv.slice(2));
const swfPath = resolve(pos[0] ?? "");
const outPath = resolve(pos[1] ?? "");
if (!existsSync(swfPath) || !outPath) {
  console.error("usage: node capture-lines.mjs <movie.swf> <out.json> [--tags M0,M1] [--done DONE]");
  process.exit(2);
}

const MIME = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".map": "application/json",
  ".html": "text/html",
  ".swf": "application/x-shockwave-flash",
};

const PLAYER_HTML = `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0">
<script src="/ruffle/ruffle.js"></script>
<script>
  window.__lines = [];
  window.RufflePlayer = window.RufflePlayer || {};
  window.addEventListener("DOMContentLoaded", function () {
    var ruffle = window.RufflePlayer.newest();
    var player = ruffle.createPlayer();
    player.style.width = "640px";
    player.style.height = "480px";
    document.body.appendChild(player);
    player.addEventListener("loadedmetadata", function () {});
    player.load({
      url: "/movie.swf",
      autoplay: "on",
      unmuteOverlay: "hidden",
      logLevel: "info",
      warnOnUnsupportedContent: false,
      allowScriptAccess: true,
      contextMenu: false,
    }).catch(function (e) { console.log("[CAPTURE_LOAD_ERR] " + e); });
  });
</script>
</body></html>`;

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  try {
    if (url === "/" || url === "/player.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(PLAYER_HTML);
      return;
    }
    if (url === "/movie.swf") {
      res.writeHead(200, { "content-type": MIME[".swf"] });
      res.end(readFileSync(swfPath));
      return;
    }
    if (url.startsWith("/ruffle/")) {
      const file = join(ruffleDir, url.slice("/ruffle/".length));
      if (existsSync(file)) {
        res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
        res.end(readFileSync(file));
        return;
      }
    }
    res.writeHead(404);
    res.end("not found");
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;
console.log(`[capture] serving ${swfPath} at ${base}`);

const browser = await puppeteer.launch({
  headless: "shell",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});

const lines = [];
let doneResolve;
const donePromise = new Promise((r) => (doneResolve = r));

const page = await browser.newPage();
const TAG_RE = /\[([A-Z0-9_]+)\]/;
page.on("console", (msg) => {
  const text = msg.text();
  // Ruffle may prefix/format trace; match our bracketed tags anywhere.
  const m = text.match(TAG_RE);
  if (!m) return;
  const tag = m[1];
  if (tag === "ERR" || tag === "CAPTURE_LOAD_ERR") {
    console.error(`[capture] harness error: ${text}`);
  }
  // capture from the first bracket onward (strip any Ruffle prefix)
  const idx = text.indexOf("[");
  lines.push(text.slice(idx));
  if (tag === opt.done) doneResolve();
});
page.on("pageerror", (e) => console.error(`[capture] pageerror: ${e}`));

await page.goto(base, { waitUntil: "domcontentloaded" });

const timeout = new Promise((_, rej) =>
  setTimeout(() => rej(new Error(`timeout after ${opt.timeout}ms (no [${opt.done}] seen)`)), opt.timeout),
);
try {
  await Promise.race([donePromise, timeout]);
} catch (e) {
  console.error(`[capture] ${e.message}`);
  console.error(`[capture] captured ${lines.length} tagged lines so far`);
  await browser.close();
  server.close();
  process.exit(1);
}

await browser.close();
server.close();

// Parse: [TAG] idx f0 f1 f2 ... -> golden[TAG][idx] = [f0, f1, ...]
// Ruffle styles trace output with %c CSS args that leak into console text, so we
// extract ONLY the data fields: each is exactly 16 lowercase-hex chars (raw f64).
const FIELDS = ["px", "py", "a", "vx", "vy", "w"];
const HEX16 = /^[0-9a-f]{16}$/;
const golden = {};
for (const line of lines) {
  const m = line.match(/\[([A-Z0-9_]+)\]\s+(\d+)\s+(.*)$/);
  if (!m) continue;
  const [, tag, idxStr, rest] = m;
  if (opt.tags && !opt.tags.includes(tag)) continue;
  const fields = rest.trim().split(/\s+/).filter((t) => HEX16.test(t));
  if (fields.length === 0) {
    console.error(`[capture] WARN ${tag} row ${idxStr}: no hex16 fields found`);
  }
  (golden[tag] ??= []).push({ step: parseInt(idxStr, 10), fields });
}

// sanity: ensure steps are contiguous from 0
for (const tag of Object.keys(golden)) {
  golden[tag].sort((a, b) => a.step - b.step);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  JSON.stringify(
    {
      meta: {
        swf: swfPath.replace(repoRoot + "/", ""),
        fields: FIELDS,
        tags: Object.fromEntries(Object.keys(golden).map((t) => [t, golden[t].length])),
        oracle: "Ruffle (selfhosted) headless via puppeteer",
      },
      golden,
    },
    null,
    2,
  ),
);
console.log(`[capture] wrote ${outPath}`);
for (const t of Object.keys(golden)) console.log(`[capture]   ${t}: ${golden[t].length} steps`);
