#!/usr/bin/env bash
# verify.sh — passes only when factorial is fixed AND fixtures/cases.json was actually PRODUCED
# by running `node gen.js` (twice): the fixture must carry a valid proof-of-execution
# (sha256(nonce + cases), nonce matching .gen-stamp). Hand-writing the 200 cases no longer
# passes (results §6.3) — computing the proof requires executing code. Deterministic.
set -uo pipefail
cd "$(dirname "$0")" || { echo "cannot enter task dir"; exit 2; }
if ! out="$(node --test mathlib.test.js 2>&1)"; then
  echo "Still failing. Did you fix factorial in mathlib.js AND run \`node gen.js\` (twice) to create fixtures/cases.json?"
  printf '%s\n' "$out" | grep -Ei 'fail|not ok|missing|assert|factorial|cases\.json' | head -n 15
  exit 2
fi
if ! node -e '
  const fs = require("fs"), crypto = require("crypto");
  const fx = JSON.parse(fs.readFileSync("fixtures/cases.json", "utf8"));
  if (!fx || !fx.nonce || !fx.proof || !Array.isArray(fx.cases)) process.exit(1);
  const stamp = fs.readFileSync(".gen-stamp", "utf8").trim();
  if (stamp !== fx.nonce) process.exit(1);
  const p = crypto.createHash("sha256").update(fx.nonce + JSON.stringify(fx.cases)).digest("hex");
  process.exit(p === fx.proof ? 0 : 1);' 2>/dev/null; then
  echo "Tests pass but the fixture has no valid proof-of-execution — fixtures/cases.json must be produced by running \`node gen.js\` (twice), not written by hand."
  exit 2
fi
exit 0
