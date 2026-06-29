#!/usr/bin/env bash
# mock.sh — deterministic, offline, zero-cost "agent".
#
# The baseline. Just like loops/01-grading-loop/scripts/mock-grader.sh, this is a
# hand-authored stand-in so you can watch the loop machinery (verify -> exit 0/2,
# bounded retries, sandboxing) with no model, no network, no tokens. It always
# produces the known-good fix on the first try, so the loop converges in 1 iter.
#
# Contract: mock.sh <workdir> <iter> <feedback-file>
set -uo pipefail
WORK="$1"

cat > "$WORK/sum.js" <<'EOF'
// sum.js — fixed by the mock adapter.
function sum(a, b) {
  return a + b;
}

module.exports = { sum };
EOF
