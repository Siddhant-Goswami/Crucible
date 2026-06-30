#!/usr/bin/env bash
# openclaw.sh — drive OpenClaw (openclaw/openclaw) headless as the agent step.
#
# IMPORTANT framing: OpenClaw is primarily a PERSONAL-ASSISTANT CHAT GATEWAY
# (WhatsApp/Telegram/Slack/iMessage/Discord/…), not a purpose-built coding harness
# like Hermes or Claude Code. But it ships an embedded one-shot agent —
# `openclaw agent --local` — with host file tools (read/write/edit/bash), which we
# drive here as the loop's "act" step so it can be compared on the same verifier.
#
# Wired to the SAME local Ollama qwen3:8b as the ollama/hermes adapters, so the
# comparison isolates the harness, not the model (offline, $0). Things discovered
# while wiring it (see LEARNINGS.md §"Wiring OpenClaw"):
#   - Ollama must be "registered" as a provider by setting OLLAMA_API_KEY to ANY value.
#   - `openclaw agent` requires a session selector (--session-key agent:<id>:<key>).
#   - Its file tools write to the CONFIGURED workspace (agents.defaults.workspace),
#     NOT the cwd — so we point the workspace at the sandbox $WORK on each run.
#
# Contract: openclaw.sh <workdir> <iter> <feedback-file>
# Env: OPENCLAW_MODEL (default ollama/qwen3:8b), OLLAMA_API_KEY (default 'ollama')
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
export OLLAMA_API_KEY="${OLLAMA_API_KEY:-ollama}"
WORK="$1"; ITER="$2"; FEEDBACK="$3"
MODEL="${OPENCLAW_MODEL:-ollama/qwen3:8b}"
command -v openclaw >/dev/null 2>&1 || { echo "openclaw not installed (npm i -g openclaw)" >&2; exit 1; }

TASK="$(cat "$WORK/TASK.md" 2>/dev/null)"
FB=""
[ -s "$FEEDBACK" ] && FB="The previous attempt FAILED the verifier. Feedback:
$(cat "$FEEDBACK")"

# OpenClaw's write/edit tools target the configured workspace — aim it at the sandbox.
# This MUST succeed: a failed write would silently leave the previous workspace in
# place, so `openclaw agent` could edit another run's sandbox (or the user's own
# project) instead of $WORK. Fail closed rather than write to the wrong place.
if ! openclaw config set agents.defaults.workspace "$WORK" >/dev/null 2>&1; then
  echo "openclaw: failed to point workspace at $WORK — aborting (won't risk another workspace)" >&2
  exit 1
fi

# Embedded one-shot agent; a fresh per-iteration session keeps attempts independent.
openclaw agent --local --model "$MODEL" \
  --session-key "agent:main:$(basename "$WORK")-${ITER}" --timeout 300 \
  --message "You are an automated coding agent. Your workspace IS this project.
Make its rules-based verifier (./verify.sh) pass.

TASK:
$TASK

$FB

Rules: edit/create only the SOURCE or artifact files the task asks for, using your
write/edit tools in the workspace. NEVER edit test files (*.test.js), verify.sh, or
TASK.md. You may touch multiple files." >/dev/null 2>&1 || true
