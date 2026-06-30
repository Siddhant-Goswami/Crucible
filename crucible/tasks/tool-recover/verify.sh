#!/usr/bin/env bash
# verify.sh — passes only when factorial is fixed AND fixtures/cases.json has been generated
# (which requires running `node gen.js` twice). Deterministic; the test owns done/keep-going.
set -uo pipefail
cd "$(dirname "$0")" || { echo "cannot enter task dir"; exit 2; }
if out="$(node --test mathlib.test.js 2>&1)"; then
  exit 0
else
  echo "Still failing. Did you fix factorial in mathlib.js AND run \`node gen.js\` (twice) to create fixtures/cases.json?"
  printf '%s\n' "$out" | grep -Ei 'fail|not ok|missing|assert|factorial|cases\.json' | head -n 15
  exit 2
fi
