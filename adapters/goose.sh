#!/usr/bin/env bash
# goose.sh — drive Goose (Block / Agentic AI Foundation) headless as the agent step.
#
# Goose is a model-agnostic, extensible on-machine agent (its signature feature is
# YAML "recipes" for repeatable workflows). Here we use its plain headless mode.
#
# Wired to the SAME local Ollama qwen3:8b as the other lean adapters, so a row
# difference is the harness, not the model (offline, $0). Config is via env so no
# `goose configure` wizard is needed:
#   GOOSE_PROVIDER=ollama  GOOSE_MODEL=qwen3:8b  OLLAMA_HOST=http://localhost:11434
#   GOOSE_MODE=auto  -> auto-approve tool calls (no prompts) in headless runs.
#
# `goose run --no-session -q -t TEXT` is the one-shot: no session file, quiet
# (model output only). Goose edits files with its tools in the current directory.
#
# Contract: goose.sh <workdir> <iter> <feedback-file>
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
export GOOSE_PROVIDER="${GOOSE_PROVIDER:-ollama}"
export GOOSE_MODEL="${GOOSE_MODEL:-qwen3:8b}"
export OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
export GOOSE_MODE="${GOOSE_MODE:-auto}"   # auto-approve tools; never hang headless
WORK="$1"; FEEDBACK="$3"
command -v goose >/dev/null 2>&1 || { echo "goose not installed" >&2; exit 1; }

TASK="$(cat "$WORK/TASK.md" 2>/dev/null)"
FB=""
[ -s "$FEEDBACK" ] && FB="The previous attempt FAILED the verifier. Feedback:
$(cat "$FEEDBACK")"

cd "$WORK" || { echo "goose: cannot enter workdir $WORK" >&2; exit 1; }
goose run --no-session -q -t "You are an automated coding agent working in the current directory.
Make this project's rules-based verifier (./verify.sh) pass.

TASK:
$TASK

$FB

Rules: edit/create only the SOURCE or artifact files the task asks for, using your
tools. NEVER edit test files (*.test.js), verify.sh, or TASK.md. You may touch
multiple files." >/dev/null 2>&1 || true
