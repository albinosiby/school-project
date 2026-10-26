#!/usr/bin/env bash
# One-shot full-design extractor. Run this while the Figma plugin is Connected
# AND the Figma window is kept in the foreground (the plugin throttles when
# Figma loses focus). Pulls: the page's frame list, a PNG + full spec for every
# top-level frame, and the prototype flow graph. Resilient: logs failures and
# keeps going.
#
#   bash tools/figma_bridge/pull_all.sh [pageNodeId]   # default page 0:1
set -u
cd "$(dirname "$0")/../.."
REQ="node tools/figma_bridge/request.js"
REN="node tools/figma_bridge/render.js"
OUT="tools/figma_bridge/.runtime/design"
mkdir -p "$OUT/spec" "$OUT/png"
PAGE="${1:-0:1}"

echo "== listing frames on $PAGE =="
$REQ inspect "{\"payload\":{\"nodeId\":\"$PAGE\",\"depth\":1}}" > "$OUT/page.json" 2>/dev/null
python3 - "$OUT/page.json" > "$OUT/frames.tsv" <<'PY'
import json,sys
try:
    d=json.load(open(sys.argv[1]))['data']['spec']
except Exception as e:
    sys.stderr.write("could not read page.json: %s\n"%e); sys.exit(1)
for c in d.get('children',[]):
    if c.get('type') in ('FRAME','COMPONENT','INSTANCE','GROUP'):
        print("%s\t%s\t%sx%s"%(c['id'], c['name'], c.get('w'), c.get('h')))
PY
n=$(wc -l < "$OUT/frames.tsv" | tr -d ' ')
echo "found $n frames"
[ "$n" = "0" ] && { echo "NO FRAMES — is the plugin Connected + Figma focused?"; exit 1; }

echo "== prototype flow =="
$REQ export_flow '{"payload":{}}' > "$OUT/flow.json" 2>/dev/null && echo "flow: $(wc -c < "$OUT/flow.json") bytes"

i=0
while IFS=$'\t' read -r id name size; do
  i=$((i+1))
  safe=$(echo "$name" | tr ' /' '__' | tr -cd 'A-Za-z0-9_-')
  echo "[$i/$n] $id $name ($size)"
  $REN "$id" 1 >/dev/null 2>&1 && cp "$(ls -t tools/figma_bridge/.runtime/render-*.png 2>/dev/null | head -1)" "$OUT/png/${id//:/_}_$safe.png" 2>/dev/null || echo "   render FAIL $id"
  $REQ inspect "{\"payload\":{\"nodeId\":\"$id\",\"depth\":12}}" > "$OUT/spec/${id//:/_}_$safe.json" 2>/dev/null
  [ -s "$OUT/spec/${id//:/_}_$safe.json" ] || echo "   spec FAIL $id"
done < "$OUT/frames.tsv"
echo "== done -> $OUT =="
