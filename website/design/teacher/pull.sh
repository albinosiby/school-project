#!/usr/bin/env bash
cd "$(dirname "$0")/../.."
O=design/teacher
while IFS=$'\t' read -r id name; do
  f=${id//:/_}; safe=$(echo "$name" | tr ' /' '__' | tr -cd 'A-Za-z0-9_.-')
  [ -s "$O/spec/${f}_$safe.json" ] && continue
  p=$(node tools/figma_bridge/render.js "$id" 1 2>/dev/null | tail -1)
  [ -f "$p" ] && cp "$p" "$O/png/${f}_$safe.png" || echo "render FAIL $id" >> $O/fail.log
  node tools/figma_bridge/request.js inspect "{\"payload\":{\"nodeId\":\"$id\",\"depth\":14}}" > "$O/spec/${f}_$safe.json" 2>/dev/null
  echo "$id $name" >> $O/progress.log
done < $O/frames.tsv
echo DONE >> $O/progress.log
