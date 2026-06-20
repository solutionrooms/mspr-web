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
import { execFileSync } from "node:child_process";
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
  sourceCommit?: string | null;
  sourceCommitShort?: string | null;
  sourceDirty?: boolean | null;
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

  // FZ3 freshness — COMMIT-aware, WARN-only.
  //
  // mspr pins a COMMIT of FZ3 (manifest.sourceCommit). You pull commits, not someone's
  // unsaved edits, so this check must NOT hard-fail just because FZ3's working tree has
  // uncommitted WIP mid-port (e.g. the m4 solver being written live) — that would make
  // mspr's suite red for work it shouldn't pull yet. The HARD invariant — mspr's vendored
  // bytes == the pinned snapshot — is already enforced by the corruption guard above; and
  // behavioral staleness (a real bugfix mspr is missing) is caught by the per-milestone
  // hex16 goldens. So here we only:
  //   - HARD: assert the pinned commit still EXISTS in FZ3 (the pin is reproducible);
  //   - WARN: if FZ3's HEAD advanced past the pin, or its src/box2d has uncommitted
  //     changes — i.e. "canonical moved; `npm run box2d:sync` when a milestone commits."
  // (Skipped entirely when FZ3 isn't checked out beside mspr — CI / standalone.)
  it.skipIf(!existsSync(FZ3_BOX2D))(
    "pinned FZ3 commit exists; warns (not fails) when canonical advances or is dirty",
    () => {
      expect(manifest).toBeTruthy();
      const FZ3_ROOT = resolve(REPO, "..", "FZ3");
      const git = (...a: string[]) =>
        execFileSync("git", ["-C", FZ3_ROOT, ...a], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();

      let head = "";
      let dirty = false;
      let pinExists = true;
      try {
        head = git("rev-parse", "HEAD");
        dirty = git("status", "--porcelain", "--", "src/box2d").length > 0;
        if (manifest!.sourceCommit) {
          try {
            git("cat-file", "-e", `${manifest!.sourceCommit}^{commit}`);
          } catch {
            pinExists = false;
          }
        }
      } catch {
        return; // FZ3 isn't a git repo here — nothing to compare against.
      }

      if (manifest!.sourceCommit && head && head !== manifest!.sourceCommit) {
        console.warn(
          `[box2d-sync] FZ3 advanced (pinned ${manifest!.sourceCommitShort ?? manifest!.sourceCommit.slice(0, 7)} → HEAD ${head.slice(0, 7)}). ` +
            `Run \`npm run box2d:sync\` to pull when the milestone is committed.`,
        );
      }
      if (dirty) {
        console.warn(
          "[box2d-sync] FZ3 src/box2d has uncommitted changes (WIP not pulled). " +
            "Sync once it lands as a commit.",
        );
      }
      // Reproducibility: the revision mspr claims to be pinned at must exist in FZ3.
      expect(
        pinExists,
        `pinned FZ3 commit ${manifest!.sourceCommit} is missing from FZ3 — history rewritten? re-sync`,
      ).toBe(true);
    },
  );
});
