#!/usr/bin/env bash
# claude.sh — drive Claude Code headless (`claude -p`) as the agent step.
#
# REAL and capable, but spends tokens on your Claude subscription, so the
# comparison harness only runs this when RUN_CLAUDE=1. This is the closest analog
# to how the 100x-loops themselves run (GRADER=claude), except here the shell owns
# the outer loop instead of a Stop hook.
#
# Contract: claude.sh <workdir> <iter> <feedback-file>
set -uo pipefail
WORK="$1"; FEEDBACK="$3"
command -v claude >/dev/null 2>&1 || { echo "claude not installed" >&2; exit 1; }

TASK="$(cat "$WORK/TASK.md" 2>/dev/null)"
FB=""; [ -s "$FEEDBACK" ] && FB="Previous verifier feedback: $(cat "$FEEDBACK")"

cd "$WORK"
claude -p "Fix sum.js in the current directory so that 'node --test' passes.
$TASK
$FB
Edit the file in place. Do not change the test file." \
  --allowedTools "Read,Edit,Write,Bash" \
  --output-format text >/dev/null 2>&1 || true
