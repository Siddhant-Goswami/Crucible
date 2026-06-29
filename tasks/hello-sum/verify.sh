#!/usr/bin/env bash
# verify.sh — the rules-based completion gate for the hello-sum task.
#
# This is the load-bearing loop primitive, identical in spirit to
# loops/00-hello-loop/scripts/verify-tests.sh — but adapter-driven instead of
# wired as a Claude Code Stop hook, so ANY harness can be the "brain".
#
#   tests pass -> exit 0 -> the loop may stop. DONE.
#   tests fail -> exit 2 -> reason printed to stdout, fed back, loop KEEPS GOING.
#
# Rules-based (the test runner), deterministic, ~free — never "ask an LLM if it's good".
set -uo pipefail
cd "$(dirname "$0")"

if out="$(node --test 2>&1)"; then
  exit 0
else
  echo "Tests are still failing. Relevant output:"
  printf '%s\n' "$out" | grep -E 'fail|not ok|AssertionError|expected:|actual:' | head -n 20
  exit 2
fi
