#!/usr/bin/env node
// sync-box2d.mjs — vendor FZ3's canonical `src/box2d/` into mspr and re-pin the
// hash manifest. See DEVELOPER_MESSAGES.md "Thread: shared engine with FZ3".
//
// The Box2DFlash 2.0.2 AS3 source is BYTE-IDENTICAL between FZ3 and mspr (74/74
// files), and the only in-engine constants file (b2Settings) is project-neutral —
// mspr's load-bearing differences (physStep, iterations, p2w, AABB, gravity) are
// all caller-side (b2World ctor / Step args / game-side PhysicsBase). So the TS
// engine is shared verbatim: FZ3 is canonical, mspr carries a pinned vendored copy.
//
// This script makes mspr's `src/box2d/` an exact mirror of FZ3's `src/box2d/`
// (.ts files), then writes `src/box2d/.box2d-sync.json` (per-file SHA-256 +
// aggregate). `test/box2d-sync.test.ts` fails the build if the mirror is ever
// hand-edited or left stale relative to FZ3 — so bit-level drift can't go silent.
//
// Usage:  node tools/sync-box2d.mjs           # sync + re-pin
//         node tools/sync-box2d.mjs --check    # verify only, non-zero exit on drift

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MSPR_ROOT = resolve(HERE, "..");
const MSPR_BOX2D = join(MSPR_ROOT, "src", "box2d");
// FZ3 and mspr are siblings under the same Projects/ dir.
const FZ3_BOX2D = resolve(MSPR_ROOT, "..", "FZ3", "src", "box2d");
const MANIFEST = join(MSPR_BOX2D, ".box2d-sync.json");

// Files that are mspr-local artifacts, never part of the vendored mirror.
const IGNORE = new Set(["README.md", ".box2d-sync.json"]);

const CHECK_ONLY = process.argv.includes("--check");

// Recursively list relative paths of .ts files under `root` (POSIX-separated,
// sorted) — the set the manifest pins. Mirror-irrelevant files are excluded.
function listTs(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name);
      const rel = relative(root, abs).split(/[\\/]/).join("/");
      if (IGNORE.has(name) || IGNORE.has(rel)) continue;
      if (statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith(".ts")) out.push(rel);
    }
  };
  walk(root);
  return out.sort();
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

// Aggregate hash = sha256 over "rel\n<filehash>\n" lines in sorted rel order, so
// it is stable regardless of filesystem ordering and changes if any file or the
// file SET changes.
function aggregate(perFile) {
  const h = createHash("sha256");
  for (const rel of Object.keys(perFile).sort()) h.update(`${rel}\n${perFile[rel]}\n`);
  return h.digest("hex");
}

function hashTree(root) {
  const perFile = {};
  for (const rel of listTs(root)) perFile[rel] = sha256(readFileSync(join(root, rel)));
  return { perFile, agg: aggregate(perFile) };
}

// FZ3 git provenance so a stale vendor names the exact canonical revision it's
// behind (game's ask #1). The aggregate content hash is the AUTHORITATIVE pin;
// the commit is a human-readable reference. `dirty` = FZ3's src/box2d/ had
// uncommitted changes at sync time, so the commit alone wouldn't reproduce it.
function gitInfo(repoDir, subdir) {
  const git = (...a) =>
    execFileSync("git", ["-C", repoDir, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try {
    const commit = git("rev-parse", "HEAD");
    const short = git("rev-parse", "--short", "HEAD");
    const dirty = git("status", "--porcelain", "--", subdir).length > 0;
    return { commit, short, dirty };
  } catch {
    return { commit: null, short: null, dirty: null };
  }
}

if (!existsSync(FZ3_BOX2D)) {
  console.error(`[sync-box2d] canonical FZ3 source not found at: ${FZ3_BOX2D}`);
  console.error("  This script must run where FZ3 is checked out beside mspr.");
  console.error("  (The vendored copy + manifest still let mspr build standalone.)");
  process.exit(1);
}

const src = hashTree(FZ3_BOX2D);

if (CHECK_ONLY) {
  if (!existsSync(MANIFEST)) {
    console.error("[sync-box2d] --check: no manifest; run `node tools/sync-box2d.mjs` first.");
    process.exit(1);
  }
  const man = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const vendored = hashTree(MSPR_BOX2D);
  const problems = [];
  // Corruption guard: vendored bytes must equal the manifest exactly.
  if (man.aggregate !== vendored.agg)
    problems.push("mspr vendored copy differs from manifest (hand-edited — re-sync).");
  // FZ3 freshness, same semantics as test/box2d-sync.test.ts: a CHANGED/REMOVED
  // pinned file is dangerous staleness (hard fail); a new ADDED upstream file is
  // benign milestone lag (warn). See that test for the rationale.
  const removed = Object.keys(man.files).filter((f) => !(f in src.perFile));
  const changed = Object.keys(man.files).filter((f) => f in src.perFile && src.perFile[f] !== man.files[f]);
  const added = Object.keys(src.perFile).filter((f) => !(f in man.files));
  if (added.length)
    console.warn(`[sync-box2d] note: FZ3 has ${added.length} new file(s) not yet vendored — run sync to pull: ${added.join(", ")}`);
  if (removed.length) problems.push(`pinned file(s) removed upstream: ${removed.join(", ")}`);
  if (changed.length) problems.push(`pinned file(s) changed upstream (mspr STALE): ${changed.join(", ")}`);
  if (problems.length) {
    const live = gitInfo(resolve(MSPR_ROOT, "..", "FZ3"), "src/box2d");
    const pinned = man.sourceCommitShort ? `${man.sourceCommitShort}${man.sourceDirty ? "-dirty" : ""}` : "(unknown)";
    const now = live.short ? `${live.short}${live.dirty ? "-dirty" : ""}` : "(unknown)";
    console.error(`[sync-box2d] DRIFT (pinned FZ3 ${pinned} → now ${now}):\n  - ` + problems.join("\n  - "));
    process.exit(1);
  }
  console.log(`[sync-box2d] OK — ${Object.keys(man.files).length} files in sync (agg ${man.aggregate.slice(0, 12)}…).`);
  process.exit(0);
}

// --- sync: make mspr/src/box2d an exact mirror of FZ3's .ts set ---
mkdirSync(MSPR_BOX2D, { recursive: true });
const srcSet = new Set(src.perFile ? Object.keys(src.perFile) : []);

// Remove vendored .ts no longer present upstream (deleted files).
for (const rel of listTs(MSPR_BOX2D)) {
  if (!srcSet.has(rel)) {
    rmSync(join(MSPR_BOX2D, rel));
    console.log(`  - removed stale ${rel}`);
  }
}

// Copy every upstream file verbatim.
let copied = 0;
for (const rel of srcSet) {
  const from = join(FZ3_BOX2D, rel);
  const to = join(MSPR_BOX2D, rel);
  mkdirSync(dirname(to), { recursive: true });
  const buf = readFileSync(from);
  const cur = existsSync(to) ? readFileSync(to) : null;
  if (!cur || !cur.equals(buf)) {
    writeFileSync(to, buf);
    copied++;
  }
}

const fz3Git = gitInfo(resolve(MSPR_ROOT, "..", "FZ3"), "src/box2d");
const manifest = {
  _comment:
    "AUTO-GENERATED by tools/sync-box2d.mjs. Do not edit. Box2D is vendored from " +
    "FZ3 (canonical); hand-editing src/box2d here breaks the bit-exact guarantee. " +
    "Re-sync with `node tools/sync-box2d.mjs`. See DEVELOPER_MESSAGES.md.",
  source: "FZ3/src/box2d",
  sourceCommit: fz3Git.commit,
  sourceCommitShort: fz3Git.short,
  // true => FZ3's src/box2d had uncommitted edits at sync; the commit alone does
  // not reproduce the pinned bytes — trust `aggregate` (content hash) instead.
  sourceDirty: fz3Git.dirty,
  aggregate: src.agg,
  files: src.perFile,
};
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

const rev = fz3Git.short ? `${fz3Git.short}${fz3Git.dirty ? "-dirty" : ""}` : "(no git)";
console.log(
  `[sync-box2d] synced ${srcSet.size} files from ${relative(MSPR_ROOT, FZ3_BOX2D)} @ ${rev} ` +
    `(${copied} changed), pinned agg ${src.agg.slice(0, 12)}…`,
);
