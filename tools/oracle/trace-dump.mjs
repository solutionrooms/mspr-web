// trace-dump — run a harness SWF under Ruffle headless and print EVERY bracketed [TAG]
// trace line (cleaned of Ruffle's %c CSS styling). Unlike capture-lines.mjs (which keeps
// only hex16 rows + surfaces only [ERR]), this shows [BOOT]/[INITERR]/diagnostic lines —
// the tool for debugging the arcade a-ladder headless bootstrap.
//
// Usage: node tools/oracle/trace-dump.mjs <movie.swf> [--secs 12] [--grep REGEX]
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const ruffleDir = join(repoRoot, "node_modules", "@ruffle-rs", "ruffle");

const argv = process.argv.slice(2);
const swf = resolve(argv.find((a) => !a.startsWith("--")) ?? "");
const secs = Number((argv[argv.indexOf("--secs") + 1]) || 12);
const grep = argv.includes("--grep") ? new RegExp(argv[argv.indexOf("--grep") + 1]) : /\[[A-Z0-9_]+\]/;
if (!existsSync(swf)) {
  console.error(`usage: node trace-dump.mjs <movie.swf> [--secs N] [--grep RE]\n  not found: ${swf}`);
  process.exit(2);
}

const MIME = { ".js": "text/javascript", ".wasm": "application/wasm", ".swf": "application/x-shockwave-flash", ".html": "text/html" };
const HTML = `<!doctype html><body><script src="/ruffle/ruffle.js"></script><script>
window.RufflePlayer=window.RufflePlayer||{};addEventListener("DOMContentLoaded",function(){
 var r=window.RufflePlayer.newest();var p=r.createPlayer();document.body.appendChild(p);
 p.load({url:"/movie.swf",autoplay:"on",logLevel:"info",allowScriptAccess:true}).catch(function(e){console.log("[LOAD_ERR] "+e)})});
</script></body>`;

const srv = http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  if (u === "/") { res.end(HTML); return; }
  if (u === "/movie.swf") { res.end(readFileSync(swf)); return; }
  if (u.startsWith("/ruffle/")) {
    const f = join(ruffleDir, u.slice(8));
    if (existsSync(f)) { res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); return; }
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const port = srv.address().port;
const clean = (t) => t.replace(/%c/g, "").replace(/(color|background|font-style):[^;]*;?/g, "").replace(/\s+/g, " ").trim();

const b = await puppeteer.launch({ headless: "shell", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"] });
const pg = await b.newPage();
pg.on("console", (m) => {
  const t = m.text();
  if (!grep.test(t)) return;
  const i = t.indexOf("[");
  console.log(clean(t.slice(i >= 0 ? i : 0)));
});
await pg.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
await new Promise((r) => setTimeout(r, secs * 1000));
await b.close();
srv.close();
