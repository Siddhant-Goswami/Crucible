#!/usr/bin/env bash
# pi.sh — drive Pi (Mario Zechner's minimal coding agent) headless as the agent step.
#
# Pi is the MINIMALIST harness in this comparison: a sub-1k-token system prompt and
# exactly four tools (read, write, edit, bash) — the deliberate opposite of a big
# batteries-included harness. (It's the same pi-ai stack that powers OpenClaw.)
#
# Wired to the SAME local Ollama qwen3:8b as the other lean adapters via a custom
# provider in ~/.pi/agent/models.json (api: openai-completions, baseUrl: …:11434/v1,
# compat.supportsDeveloperRole=false for Ollama). So a row difference is the harness,
# not the model (offline, $0).
#
# `pi -p PROMPT` is the non-interactive mode (process the prompt and exit); Pi edits
# files with its own read/write/edit tools in the current directory.
#
# Contract: pi.sh <workdir> <iter> <feedback-file>
# Env: PI_MODEL (default ollama/qwen3:8b)
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
WORK="$1"; FEEDBACK="$3"
# Honor the Crucible model axis (HARNESS_MODEL) so pi runs on the same model as the other
# harnesses; falls back to PI_MODEL / qwen3:8b.
MODEL="${PI_MODEL:-ollama/${HARNESS_MODEL:-qwen3:8b}}"
command -v pi >/dev/null 2>&1 || { echo "pi not installed (npm i -g @mariozechner/pi-coding-agent)" >&2; exit 1; }

# Crucible: pi reaches Ollama via its own config baseUrl (~/.pi/agent/models.json), so to
# meter its tokens we temporarily point that provider's baseUrl at the Crucible proxy
# (OLLAMA_HOST, OpenAI-compat /v1) and restore the file verbatim on exit. Recover-first guards
# against a prior hard-killed run leaving the config (and its backup) corrupted.
PICFG="$HOME/.pi/agent/models.json"
if [ -n "${CRUCIBLE:-}" ] && [ -n "${OLLAMA_HOST:-}" ] && [ -f "$PICFG" ]; then
  [ -f "$PICFG.crucible-bak" ] && mv -f "$PICFG.crucible-bak" "$PICFG"
  cp "$PICFG" "$PICFG.crucible-bak"
  trap 'mv -f "$PICFG.crucible-bak" "$PICFG" 2>/dev/null || true' EXIT INT TERM
  node -e 'const fs=require("fs"),f=process.argv[1];const c=JSON.parse(fs.readFileSync(f,"utf8"));
    if (c.providers && c.providers.ollama) c.providers.ollama.baseUrl = process.argv[2];
    fs.writeFileSync(f, JSON.stringify(c, null, 1));' "$PICFG" "${OLLAMA_HOST%/}/v1" 2>/dev/null || true
fi

TASK="$(cat "$WORK/TASK.md" 2>/dev/null)"
FB=""
[ -s "$FEEDBACK" ] && FB="The previous attempt FAILED the verifier. Feedback:
$(cat "$FEEDBACK")"

cd "$WORK" || { echo "pi: cannot enter workdir $WORK" >&2; exit 1; }
pi --model "$MODEL" -p "You are an automated coding agent working in the current directory.
Make this project's rules-based verifier (./verify.sh) pass.

TASK:
$TASK

$FB

Rules: edit/create only the SOURCE or artifact files the task asks for, using your
write/edit tools. NEVER edit test files (*.test.js), verify.sh, or TASK.md. You may
touch multiple files." >/dev/null 2>&1 || true
