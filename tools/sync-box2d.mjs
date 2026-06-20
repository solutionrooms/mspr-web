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

// Aggregate hash of FZ3's box2d as COMMITTED at HEAD (reads blobs via `git show`, NOT the
// working tree — so uncommitted WIP is ignored). This is what makes the freshness gate
// CONTENT-based: a squash/rebase that rewrites the commit SHA but leaves box2d byte-
// identical is NOT "stale" (same aggregate), while a real committed advance IS. Returns
// null if git/HEAD is unavailable. `subdir` is the box2d path relative to the repo root.
// Read FZ3's box2d as COMMITTED at HEAD: { rel -> Buffer } of each tracked .ts blob via
// `git show` (NOT the working tree). This is what the sync vendors — so uncommitted WIP
// (a half-ported m6/m7) can NEVER be pinned into mspr; we only ever vendor a reproducible
// committed revision. Returns null if git/HEAD is unavailable (caller falls back to the
// working tree). `subdir` is the box2d path relative to the repo root.
function readHeadTree(repoDir, subdir) {
  const gitText = (...a) =>
    execFileSync("git", ["-C", repoDir, ...a], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  const gitBuf = (...a) =>
    execFileSync("git", ["-C", repoDir, ...a], { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  try {
    const listed = gitText("ls-tree", "-r", "--name-only", "HEAD", "--", subdir).trim();
    if (!listed) return null;
    const prefix = subdir.replace(/\/?$/, "/");
    const perFile = {};
    for (const path of listed.split("\n")) {
      const base = path.split("/").pop();
      const rel = path.slice(prefix.length).split(/[\\/]/).join("/");
      if (!path.endsWith(".ts") || IGNORE.has(base) || IGNORE.has(rel)) continue;
      perFile[rel] = gitBuf("show", `HEAD:${path}`);
    }
    return perFile;
  } catch {
    return null;
  }
}

function gitHeadAggregate(repoDir, subdir) {
  const head = readHeadTree(repoDir, subdir);
  if (!head) return null;
  const perFile = {};
  for (const rel of Object.keys(head)) perFile[rel] = sha256(head[rel]);
  return aggregate(perFile);
}

if (!existsSync(FZ3_BOX2D)) {
  console.error(`[sync-box2d] canonical FZ3 source not found at: ${FZ3_BOX2D}`);
  console.error("  This script must run where FZ3 is checked out beside mspr.");
  console.error("  (The vendored copy + manifest still let mspr build standalone.)");
  process.exit(1);
}

if (CHECK_ONLY) {
  if (!existsSync(MANIFEST)) {
    console.error("[sync-box2d] --check: no manifest; run `node tools/sync-box2d.mjs` first.");
    process.exit(1);
  }
  const man = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const vendored = hashTree(MSPR_BOX2D);
  // HARD: corruption guard — vendored bytes must equal the manifest exactly. This is
  // the bit-exact invariant (no hand-edits to the vendored engine).
  if (man.aggregate !== vendored.agg) {
    console.error("[sync-box2d] DRIFT: mspr vendored copy differs from manifest (hand-edited — re-sync).");
    process.exit(1);
  }
  // FZ3 freshness — CONTENT-based (commit SHA is a human ref only). NOTE the deliberate
  // split vs test/box2d-sync.test.ts: the TEST treats freshness as warn-only (mspr's own
  // correctness must not be hostage to FZ3's commit cadence), but THIS command is the
  // explicit "am I in sync?" gate — so a real committed CONTENT advance is a HARD fail
  // (a milestone is waiting; pull it). A squash/rebase that rewrites the SHA but leaves
  // box2d byte-identical is NOT stale; uncommitted WIP is a warn (you pull commits).
  const FZ3_ROOT = resolve(MSPR_ROOT, "..", "FZ3");
  const live = gitInfo(FZ3_ROOT, "src/box2d");
  const headAgg = gitHeadAggregate(FZ3_ROOT, "src/box2d");
  if (live.dirty)
    console.warn("[sync-box2d] note: FZ3 src/box2d has uncommitted WIP (not pulled) — sync once it lands as a commit.");
  if (headAgg && headAgg !== man.aggregate) {
    console.error(
      `[sync-box2d] STALE: FZ3 box2d content advanced (pinned ${man.sourceCommitShort ?? "?"} → HEAD ${live.short ?? "?"}). ` +
        "A milestone is waiting — run `npm run box2d:sync` to pull, then add the mspr golden.",
    );
    process.exit(1);
  }
  if (man.sourceCommit && live.commit && live.commit !== man.sourceCommit)
    console.warn(
      `[sync-box2d] note: FZ3 commit changed (${man.sourceCommitShort ?? "?"} → ${live.short}) but box2d content is identical (squash/rebase). ` +
        "Re-run `npm run box2d:sync` to re-pin the ref (no content change).",
    );
  console.log(`[sync-box2d] OK — vendored matches manifest (${Object.keys(man.files).length} files, agg ${man.aggregate.slice(0, 12)}…, pinned FZ3 ${man.sourceCommitShort ?? "?"}).`);
  process.exit(0);
}

// --- sync: make mspr/src/box2d an exact mirror of FZ3's COMMITTED HEAD .ts set ---
// Vendor from `git show HEAD:` (committed content) so uncommitted WIP is never pinned.
// Fall back to the working tree only if FZ3 isn't a git checkout here.
const FZ3_ROOT = resolve(MSPR_ROOT, "..", "FZ3");
const fz3Git = gitInfo(FZ3_ROOT, "src/box2d");
const headTree = readHeadTree(FZ3_ROOT, "src/box2d"); // { rel -> Buffer } or null
let contentOf; // (rel) -> Buffer
let srcSet;
if (headTree) {
  if (fz3Git.dirty)
    console.warn(
      "[sync-box2d] note: FZ3 src/box2d has uncommitted WIP — vendoring the COMMITTED HEAD " +
        `(${fz3Git.short}), NOT the working tree. Re-sync after it commits to pull the rest.`,
    );
  srcSet = new Set(Object.keys(headTree));
  contentOf = (rel) => headTree[rel];
} else {
  console.warn("[sync-box2d] note: FZ3 is not a git checkout — falling back to working-tree copy.");
  const wt = hashTree(FZ3_BOX2D);
  srcSet = new Set(Object.keys(wt.perFile));
  contentOf = (rel) => readFileSync(join(FZ3_BOX2D, rel));
}

mkdirSync(MSPR_BOX2D, { recursive: true });

// Remove vendored .ts no longer present upstream (deleted files).
for (const rel of listTs(MSPR_BOX2D)) {
  if (!srcSet.has(rel)) {
    rmSync(join(MSPR_BOX2D, rel));
    console.log(`  - removed stale ${rel}`);
  }
}

// Copy every upstream file verbatim + compute the pinned hashes from the SAME bytes.
let copied = 0;
const perFile = {};
for (const rel of srcSet) {
  const buf = contentOf(rel);
  perFile[rel] = sha256(buf);
  const to = join(MSPR_BOX2D, rel);
  mkdirSync(dirname(to), { recursive: true });
  const cur = existsSync(to) ? readFileSync(to) : null;
  if (!cur || !cur.equals(buf)) {
    writeFileSync(to, buf);
    copied++;
  }
}
const agg = aggregate(perFile);

const manifest = {
  _comment:
    "AUTO-GENERATED by tools/sync-box2d.mjs. Do not edit. Box2D is vendored from " +
    "FZ3 (canonical) at the COMMITTED HEAD; hand-editing src/box2d here breaks the " +
    "bit-exact guarantee. Re-sync with `node tools/sync-box2d.mjs`. See DEVELOPER_MESSAGES.md.",
  source: "FZ3/src/box2d",
  sourceCommit: fz3Git.commit,
  sourceCommitShort: fz3Git.short,
  // FZ3 working tree had uncommitted edits at sync time (informational only — the
  // vendored content is the COMMITTED HEAD, so `aggregate` is reproducible from the commit).
  sourceDirty: fz3Git.dirty,
  aggregate: agg,
  files: perFile,
};
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

console.log(
  `[sync-box2d] synced ${srcSet.size} files from FZ3 @ ${fz3Git.short ?? "(no git)"} (committed HEAD) ` +
    `(${copied} changed), pinned agg ${agg.slice(0, 12)}…`,
);
