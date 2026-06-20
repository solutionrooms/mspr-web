// Drift guard for the vendored Box2D engine.
//
// mspr's src/box2d/ is a VENDORED pinned copy of FZ3's canonical src/box2d/ (the
// Box2DFlash 2.0.2 AS3 source is byte-identical between the two games; only the
// caller-side config differs — see DEVELOPER_MESSAGES.md "Thread: shared engine
// with FZ3"). For a BIT-EXACT engine, a silent one-ULP divergence between the two
// copies is the one failure the Prime Directive can't tolerate. This test makes
// drift a hard, loud build failure instead:
//
//   1. recompute the vendored files' SHA-256 vs the pinned manifest
//      → fails if anyone hand-edited mspr/src/box2d/ (re-sync, don't patch here);
//   2. if FZ3 is checked out beside mspr, hash FZ3's LIVE src/box2d/ vs the manifest
//      → fails if FZ3 advanced and mspr wasn't re-synced (stale vendor);
//      skips gracefully when FZ3 isn't present (CI / standalone mspr build).
//
// To clear a failure: `node tools/sync-box2d.mjs` (re-vendors + re-pins).
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const MSPR_BOX2D = join(REPO, "src", "box2d");
const FZ3_BOX2D = resolve(REPO, "..", "FZ3", "src", "box2d");
const MANIFEST = join(MSPR_BOX2D, ".box2d-sync.json");
const IGNORE = new Set(["README.md", ".box2d-sync.json"]);

function listTs(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
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

const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

function hashTree(root: string): { perFile: Record<string, string>; agg: string } {
  const perFile: Record<string, string> = {};
  for (const rel of listTs(root)) perFile[rel] = sha256(readFileSync(join(root, rel)));
  const h = createHash("sha256");
  for (const rel of Object.keys(perFile).sort()) h.update(`${rel}\n${perFile[rel]}\n`);
  return { perFile, agg: h.digest("hex") };
}

interface Manifest {
  source: string;
  aggregate: string;
  files: Record<string, string>;
}

describe("box2d vendoring — drift guard (bit-exact engine must not diverge from FZ3)", () => {
  it("a manifest exists (run `node tools/sync-box2d.mjs` if missing)", () => {
    expect(existsSync(MANIFEST), `missing ${relative(REPO, MANIFEST)}`).toBe(true);
  });

  const manifest: Manifest | null = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, "utf8"))
    : null;

  it("vendored src/box2d matches the pinned manifest (no hand-edits)", () => {
    expect(manifest).toBeTruthy();
    const vendored = hashTree(MSPR_BOX2D);
    // Per-file diff first so a failure names the offending file(s).
    const want = manifest!.files;
    const missing = Object.keys(want).filter((f) => !(f in vendored.perFile));
    const extra = Object.keys(vendored.perFile).filter((f) => !(f in want));
    const changed = Object.keys(want).filter(
      (f) => f in vendored.perFile && vendored.perFile[f] !== want[f],
    );
    expect(
      { missing, extra, changed },
      "vendored copy diverged from manifest — re-sync with `node tools/sync-box2d.mjs`",
    ).toEqual({ missing: [], extra: [], changed: [] });
    expect(vendored.agg).toBe(manifest!.aggregate);
  });

  // FZ3 freshness. Two categories of upstream drift, treated differently because
  // only one is dangerous to a BIT-EXACT engine:
  //   - CHANGED / REMOVED pinned file: mspr currently vendors this file, so its
  //     bytes now differ from canonical — mspr would run a stale engine for code
  //     it actually imports (e.g. a solver bugfix it's missing). HARD FAIL.
  //   - ADDED upstream file: a later-milestone file mspr hasn't adopted yet. It is
  //     not imported until mspr pulls it, so it cannot change mspr's behavior.
  //     Benign lag during co-development → loud warn, not a failure.
  // (Skipped entirely when FZ3 isn't checked out beside mspr — CI / standalone.)
  it.skipIf(!existsSync(FZ3_BOX2D))(
    "no pinned Box2D file has diverged from FZ3 canonical (changed/removed → re-sync)",
    () => {
      expect(manifest).toBeTruthy();
      const fz3 = hashTree(FZ3_BOX2D);
      const want = manifest!.files;
      const removed = Object.keys(want).filter((f) => !(f in fz3.perFile));
      const changed = Object.keys(want).filter(
        (f) => f in fz3.perFile && fz3.perFile[f] !== want[f],
      );
      const added = Object.keys(fz3.perFile).filter((f) => !(f in want));
      if (added.length) {
        // Benign: FZ3 has new milestone files mspr hasn't vendored. Surface it
        // loudly so the lag is visible, but don't block mspr's unrelated work.
        console.warn(
          `[box2d-sync] FZ3 has ${added.length} new file(s) not yet vendored ` +
            `(run \`node tools/sync-box2d.mjs\` to pull): ${added.join(", ")}`,
        );
      }
      // Dangerous staleness: a file mspr already vendors changed/vanished upstream.
      expect(
        { removed, changed },
        "a Box2D file mspr vendors diverged from FZ3 — re-sync with `node tools/sync-box2d.mjs`",
      ).toEqual({ removed: [], changed: [] });
    },
  );
});
