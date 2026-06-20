// Pixel-diff the WebGL2 compositor output vs the Flash/Ruffle reference.
// Emits stats + out/diff.png (amplified abs diff) + out/sidebyside.png.
import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "out");
const A = PNG.sync.read(readFileSync(join(outDir, "webgl.png")));  // mine
const B = PNG.sync.read(readFileSync(join(outDir, "ruffle.png"))); // reference
const W = Math.min(A.width, B.width), H = Math.min(A.height, B.height);

let sumAbs = 0, n = 0, maxAbs = 0;
const bands = { le2: 0, le8: 0, le16: 0, le32: 0, gt32: 0 };
const diff = new PNG({ width: W, height: H });
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const ai = (y * A.width + x) * 4, bi = (y * B.width + x) * 4, di = (y * W + x) * 4;
    let pixMax = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(A.data[ai + c] - B.data[bi + c]);
      sumAbs += d; n++;
      if (d > maxAbs) maxAbs = d;
      if (d > pixMax) pixMax = d;
    }
    if (pixMax <= 2) bands.le2++;
    else if (pixMax <= 8) bands.le8++;
    else if (pixMax <= 16) bands.le16++;
    else if (pixMax <= 32) bands.le32++;
    else bands.gt32++;
    const amp = Math.min(255, pixMax * 4);
    diff.data[di] = amp; diff.data[di + 1] = amp; diff.data[di + 2] = amp; diff.data[di + 3] = 255;
  }
}
writeFileSync(join(outDir, "diff.png"), PNG.sync.write(diff));

// side-by-side: webgl | ruffle | diff
const pad = 8;
const sbs = new PNG({ width: W * 3 + pad * 2, height: H });
sbs.data.fill(0);
const blit = (src, ox) => {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const s = (y * src.width + x) * 4, d = (y * sbs.width + (x + ox)) * 4;
      sbs.data[d] = src.data[s]; sbs.data[d + 1] = src.data[s + 1];
      sbs.data[d + 2] = src.data[s + 2]; sbs.data[d + 3] = 255;
    }
};
blit(A, 0); blit(B, W + pad); blit(diff, (W + pad) * 2);
writeFileSync(join(outDir, "sidebyside.png"), PNG.sync.write(sbs));

const totalPix = W * H;
const pct = (v) => ((v / totalPix) * 100).toFixed(2) + "%";
console.log(`[diff] ${W}x${H}, ${totalPix} px`);
console.log(`[diff] mean abs channel error: ${(sumAbs / n).toFixed(3)} / 255`);
console.log(`[diff] max abs channel error:  ${maxAbs} / 255`);
console.log(`[diff] per-pixel max-channel-diff distribution:`);
console.log(`[diff]   <= 2  (exact-ish): ${pct(bands.le2)}`);
console.log(`[diff]   <= 8           : ${pct(bands.le2 + bands.le8)} (cumulative)`);
console.log(`[diff]   <= 16          : ${pct(bands.le2 + bands.le8 + bands.le16)} (cumulative)`);
console.log(`[diff]   <= 32          : ${pct(bands.le2 + bands.le8 + bands.le16 + bands.le32)} (cumulative)`);
console.log(`[diff]   >  32 (mismatch): ${pct(bands.gt32)}  <- edge AA + sampling, expect small & edge-localised`);
console.log(`[diff] wrote diff.png, sidebyside.png`);
