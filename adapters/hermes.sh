#!/usr/bin/env bash
# hermes.sh — drive Hermes Agent (Nous Research) headless as a TASK-AGNOSTIC step.
#
# Hermes is the RECOMMENDED production harness in this prototype's comparison (see
# LEARNINGS.md): same agentskills.io skill format as the 100x-loops, a real safety
# model (command-approval + sandbox backends), and a purpose-built headless mode
# `hermes -z` ("single prompt in, final text out") that is a perfect loop adapter.
#
# Wired here to the SAME local Ollama qwen3:8b the `ollama` adapter uses, so the
# comparison isolates the HARNESS, not the model (offline, $0). One-time config
# (already applied on this machine — see LEARNINGS.md §6):
#   hermes config set model.provider ollama
#   hermes config set model.base_url http://localhost:11434/v1
#   hermes config set model.default qwen3:8b
#   hermes config set model.context_length 65536   # Hermes requires >=64K context
#   hermes config set model.ollama_num_ctx 65536   # make Ollama load it at 64K
#   hermes config set terminal.backend local       # leanest; 'docker' for isolation
#
# `hermes -z PROMPT` prints ONLY the final response and auto-bypasses command
# approvals (it's intended for scripts), editing files with its own read/write/edit
# tools in the current directory. The rules-based verifier still owns done/keep-going.
#
# Contract: hermes.sh <workdir> <iter> <feedback-file>
set -uo pipefail
export PATH="$HOME/.hermes/bin:$HOME/.local/bin:$PATH"
WORK="$1"; FEEDBACK="$3"
command -v hermes >/dev/null 2>&1 || { echo "hermes not installed — see LEARNINGS.md §6" >&2; exit 1; }

# Crucible: hermes reads model.base_url/model.default from its config.yaml (not env), so to
# meter its tokens we temporarily point base_url at the Crucible proxy (OLLAMA_HOST, OpenAI-
# compat /v1) and set the model axis via `hermes config set`, then restore the ORIGINAL file
# verbatim on exit. Sequential runs only (the battery is sequential); the trap guards a crash.
HCFG="$(hermes config path 2>/dev/null || echo "$HOME/.hermes/config.yaml")"
if [ -n "${CRUCIBLE:-}" ] && [ -n "${OLLAMA_HOST:-}" ] && [ -f "$HCFG" ]; then
  cp "$HCFG" "$HCFG.crucible-bak"
  trap 'mv -f "$HCFG.crucible-bak" "$HCFG" 2>/dev/null || true' EXIT
  hermes config set model.base_url "${OLLAMA_HOST%/}/v1" >/dev/null 2>&1 || true
  [ -n "${HARNESS_MODEL:-}" ] && hermes config set model.default "$HARNESS_MODEL" >/dev/null 2>&1 || true
fi

TASK="$(cat "$WORK/TASK.md" 2>/dev/null)"
FB=""
[ -s "$FEEDBACK" ] && FB="The previous attempt FAILED the verifier. Feedback:
$(cat "$FEEDBACK")"

cd "$WORK" || { echo "hermes: cannot enter workdir $WORK" >&2; exit 1; }
# -z is Hermes' headless one-shot entrypoint (no banner/spinner; final text only).
hermes -z "You are an automated coding agent working in the current directory.
Make this project's rules-based verifier (./verify.sh) pass.

TASK:
$TASK

$FB

Rules: edit/create only the SOURCE or artifact files the task asks for. NEVER edit
test files (*.test.js), verify.sh, or TASK.md. You may touch multiple files.
Output nothing but your edits." >/dev/null 2>&1 || true
