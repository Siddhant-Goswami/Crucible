#!/usr/bin/env bash
# ollama.sh — a REAL agent step backed by a LOCAL model (offline, zero API cost).
#
# This is the "safe + lean to run AS OF NOW" path: the model runs on your machine
# via Ollama's HTTP API, so there is no network call off-box, no API key, and no
# per-token cost. The only side effect is writing sum.js inside the sandboxed
# workdir.
#
# It demonstrates the genuine agent loop: the model proposes a fix from the task
# + the *previous verifier feedback*, we apply it, and the rules-based gate decides
# whether to stop or feed the failure back for another attempt.
#
# Design notes (see LEARNINGS.md "Gotchas"):
#   - We call the HTTP API (/api/generate), NOT `ollama run`, because the CLI emits
#     TTY spinner/cursor escape codes even when piped — the API returns clean JSON.
#   - think:false disables qwen3/deepseek-r1 chain-of-thought — ~10x faster and no
#     reasoning prose leaking into the file.
#   - We force the model to wrap the file in ===BEGIN===/===END=== sentinels and
#     extract between them, which is robust to any stray commentary.
#
# Contract: ollama.sh <workdir> <iter> <feedback-file>
# Env: OLLAMA_MODEL (default qwen3:8b), OLLAMA_HOST (default http://localhost:11434)
set -uo pipefail
WORK="$1"; ITER="$2"; FEEDBACK="$3"
MODEL="${OLLAMA_MODEL:-qwen3:8b}"
HOST="${OLLAMA_HOST:-http://localhost:11434}"

TASK="$(cat "$WORK/TASK.md" 2>/dev/null)"
CODE="$(cat "$WORK/sum.js" 2>/dev/null)"
FB=""; [ -s "$FEEDBACK" ] && FB="$(cat "$FEEDBACK")"

PROMPT="You are an automated code-fixing agent. Output ONLY the complete corrected
contents of the file sum.js, wrapped EXACTLY between these markers:
===BEGIN===
<file contents>
===END===
No markdown fences, no commentary outside the markers.

GOAL:
$TASK

CURRENT sum.js:
$CODE"
if [ -n "$FB" ]; then
  PROMPT="$PROMPT

The previous attempt FAILED the test suite. Verifier said:
$FB
Fix the bug and output the corrected sum.js."
fi

RESP="$(curl -s "$HOST/api/generate" \
  -d "$(jq -n --arg m "$MODEL" --arg p "$PROMPT" '{model:$m, prompt:$p, stream:false, think:false}')")"

TEXT="$(printf '%s' "$RESP" | jq -r '.response // empty')"

# Record real token usage so cost.js can price the run. Ollama returns
# prompt_eval_count (input) and eval_count (output). Accumulate across iters.
IN="$(printf '%s' "$RESP" | jq -r '.prompt_eval_count // 0')"
OUT="$(printf '%s' "$RESP" | jq -r '.eval_count // 0')"
PREV_IN=0; PREV_OUT=0
if [ -f "$WORK/.tokens" ]; then read -r PREV_IN PREV_OUT < "$WORK/.tokens"; fi
echo "$(( PREV_IN + IN )) $(( PREV_OUT + OUT ))" > "$WORK/.tokens"
CLEAN="$(printf '%s' "$TEXT" \
  | awk '/===BEGIN===/{f=1;next} /===END===/{f=0} f' \
  | sed -E '/^[[:space:]]*```/d')"

# Only overwrite if the output actually looks like the module (defensive: a bad
# generation leaves the file unchanged, the verifier fails, and the loop retries
# or hits max_iters — an honest failure rather than a corrupted file).
if printf '%s' "$CLEAN" | grep -q 'module.exports'; then
  printf '%s\n' "$CLEAN" > "$WORK/sum.js"
else
  echo "  (ollama: no usable module in response; leaving file unchanged)" >&2
fi
