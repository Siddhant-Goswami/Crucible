#!/usr/bin/env bash
# verify.sh — passes only when the tally->total rename is consistent across all 5 files.
set -uo pipefail
cd "$(dirname "$0")" || { echo "cannot enter task dir"; exit 2; }
if out="$(node --test migrate.test.js 2>&1)"; then
  exit 0
else
  echo "Rename incomplete/inconsistent. core.js must export \`total\` (not \`tally\`), and a/b/c/d.js must all call core.total."
  printf '%s\n' "$out" | grep -Ei 'fail|not ok|assert|tally|total|TypeError' | head -n 15
  exit 2
fi
