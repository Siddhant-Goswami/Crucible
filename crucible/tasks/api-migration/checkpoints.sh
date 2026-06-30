#!/usr/bin/env bash
# checkpoints.sh — per-file migration progress (partial credit + State). Prints "<hit> <total>".
# A file counts as migrated when it references the NEW name and no longer the OLD one.
cd "$(dirname "$0")" || { echo "0 5"; exit 1; }
hit=0; total=5
grep -qF 'total' core.js && ! grep -qF 'tally' core.js && hit=$((hit+1))
for f in a.js b.js c.js d.js; do
  grep -qF 'core.total' "$f" && ! grep -qF 'core.tally' "$f" && hit=$((hit+1))
done
echo "$hit $total"
