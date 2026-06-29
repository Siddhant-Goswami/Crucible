#!/usr/bin/env bash
# hermes.sh — drive Hermes Agent (Nous Research) headless as the agent step.
#
# Hermes is the RECOMMENDED production harness in this prototype's comparison
# (see LEARNINGS.md): same agentskills.io skill format as the 100x-loops, a
# real safety model (command-approval + blocklist + tirith + SSRF guard, plus
# docker/ssh sandbox backends), and a purpose-built headless mode `hermes -z`
# that is "single prompt in, final text out" — a perfect loop adapter.
#
# Not installed by default here (it's a curl|bash install + Node/Playwright deps).
# To enable, see LEARNINGS.md §"Wiring Hermes live". For a SAFE + LEAN + OFFLINE
# Hermes, configure it before running:
#   hermes config set terminal.backend local        # leanest; or 'docker' for isolation
#   hermes config set model.provider custom          # point at local Ollama:
#   hermes config set model.base_url http://localhost:11434/v1
#   # keep command-approval = manual (default); never --yolo on the local backend
#
# Contract: hermes.sh <workdir> <iter> <feedback-file>
set -uo pipefail
WORK="$1"; FEEDBACK="$3"
command -v hermes >/dev/null 2>&1 || { echo "hermes not installed — see LEARNINGS.md" >&2; exit 1; }

TASK="$(cat "$WORK/TASK.md" 2>/dev/null)"
FB=""; [ -s "$FEEDBACK" ] && FB="Previous verifier feedback: $(cat "$FEEDBACK")"

cd "$WORK"
# -z is Hermes' headless one-shot entrypoint (no banner/spinner; final text only).
hermes -z "In the current directory, fix sum.js so that 'node --test' passes.
$TASK
$FB
Edit sum.js in place. Do not change the test file. Output nothing else." >/dev/null 2>&1 || true
