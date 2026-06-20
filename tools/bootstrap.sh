#!/usr/bin/env bash
# Regenerate the third-party-derived artifacts that are gitignored from this
# (public) repo — the original SWF, the FFDec tool, the decompiled export, the
# game-data JSON, and the render sprite/atlas assets. Run once after cloning.
#
#   npm run bootstrap     (or: bash tools/bootstrap.sh)
#
# Requires: curl, unzip, a JDK (java), python3, node. The SWF is freely
# downloadable from Newgrounds portal 668706; this script does not redistribute it.
set -euo pipefail
cd "$(dirname "$0")/.."

SWF_URL="https://uploads.ungrounded.net/668000/668706_mspaintracer.swf"
FFDEC_URL="https://github.com/jindrapetrik/jpexs-decompiler/releases/download/version26.2.1/ffdec_26.2.1.zip"

# 1. original SWF
if [ ! -f mspaintracer.swf ]; then
  echo "[bootstrap] downloading SWF from Newgrounds…"
  curl -fsSL -A "Mozilla/5.0" -e "https://www.newgrounds.com/portal/view/668706" "$SWF_URL" -o mspaintracer.swf
else
  echo "[bootstrap] SWF present, skipping download"
fi

# 2. FFDec (decompiler + exporter + harness injector)
if [ ! -f tools/ffdec/ffdec.jar ]; then
  echo "[bootstrap] downloading FFDec 26.2.1…"
  curl -fsSL "$FFDEC_URL" -o /tmp/mspr-ffdec.zip
  mkdir -p tools/ffdec && ( cd tools/ffdec && unzip -oq /tmp/mspr-ffdec.zip ) && rm -f /tmp/mspr-ffdec.zip
else
  echo "[bootstrap] FFDec present, skipping download"
fi

# 3. decompiled export — AS3 scripts + binaryData XML  → extracted/{scripts,binaryData}
if [ ! -d extracted/scripts ]; then
  echo "[bootstrap] exporting scripts + binaryData (FFDec, ~30s)…"
  java -Djava.awt.headless=true -jar tools/ffdec/ffdec.jar -export script,binaryData extracted mspaintracer.swf
else
  echo "[bootstrap] extracted/scripts present, skipping export"
fi

# 4. game-data JSON  → data/*.json
echo "[bootstrap] extracting data JSON…"
python3 tools/extract_data.py

# 5. render assets (sprite PNGs → packed atlas) — render-owned pipeline (non-fatal)
echo "[bootstrap] building render atlas (sprite export + pack, ~70s)…"
node tools/atlas/ffdec-export.mjs || echo "[bootstrap] WARN: sprite export failed (render pipeline) — continuing"
node tools/atlas/build-atlas.mjs  || echo "[bootstrap] WARN: atlas build failed (render pipeline) — continuing"

echo "[bootstrap] done. Next: npm install && npm test"
