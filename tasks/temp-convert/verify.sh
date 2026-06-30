#!/usr/bin/env bash
# verify.sh — rules-based completion gate for the temp-convert task.
#   tests pass -> exit 0 -> loop may stop. DONE.
#   tests fail -> exit 2 -> reason printed, fed back, loop KEEPS GOING.
# Deterministic, ~free — never "ask an LLM if it's good".
set -uo pipefail
cd "$(dirname "$0")"

if out="$(node --test 2>&1)"; then
  exit 0
else
  echo "Tests are still failing. Relevant output:"
  printf '%s\n' "$out" | grep -E 'fail|not ok|AssertionError|expected:|actual:' | head -n 20
  exit 2
fi
