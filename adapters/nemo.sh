#!/usr/bin/env bash
# nemo.sh — drive nemo-agent (truemagic-coder), the LEANEST-to-install agent.
#
# nemo-agent is `uvx`-launched and tiny, but it is GREENFIELD-oriented: it
# scaffolds a whole new project (code + pytest + lint) from a natural-language
# task, rather than editing an existing file in place. So it fits a "generate"
# task better than the "fix this file" hello-sum task. It also has NO host
# sandbox (it runs model-written code directly) — run it inside a container if
# you care about your filesystem. See LEARNINGS.md §5.5.
#
# This adapter is provided for completeness / documentation. For the in-place
# edit tasks here, prefer the ollama/hermes/claude adapters.
#
# Contract: nemo.sh <workdir> <iter> <feedback-file>
# Env: NEMO_MODEL (e.g. mistral-nemo for local Ollama), or set OPENAI_API_KEY/GEMINI_API_KEY
set -uo pipefail
WORK="$1"; FEEDBACK="$3"
command -v uvx >/dev/null 2>&1 || { echo "uvx not installed (pip install uv)" >&2; exit 1; }

TASK="$(cat "$WORK/TASK.md" 2>/dev/null)"
FB=""; [ -s "$FEEDBACK" ] && FB="Previous verifier feedback: $(cat "$FEEDBACK")"

cd "$WORK"
# nemo-agent writes into the current directory. --model selects the backend
# (default cloud; pass a local Ollama model like 'mistral-nemo' for offline).
uvx nemo-agent ${NEMO_MODEL:+--model "$NEMO_MODEL"} \
  "Edit sum.js in this directory so 'node --test' passes. $TASK $FB" \
  >/dev/null 2>&1 || true
