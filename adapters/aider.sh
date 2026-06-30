#!/usr/bin/env bash
# aider.sh — drive aider (paulgauthier/aider) headless as the agent step.
#
# aider is the most widely-used OSS pair-programming agent. Run here against a LOCAL model via
# Ollama for a fair, offline comparison. It's METERED cleanly: OLLAMA_API_BASE points aider's
# Ollama traffic at the Crucible proxy, so tokens are captured.
#
# Contract: aider.sh <workdir> <iter> <feedback-file>
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
WORK="$1"; FEEDBACK="$3"
MODEL="${HARNESS_MODEL:-qwen3:8b}"
command -v aider >/dev/null 2>&1 || { echo "aider not installed (uv tool install aider-chat)" >&2; exit 1; }

# route Ollama through the Crucible proxy (OpenAI/native) so tokens are metered
export OLLAMA_API_BASE="${OLLAMA_HOST:-http://localhost:11434}"

TASK="$(cat "$WORK/TASK.md" 2>/dev/null)"
FB=""; [ -s "$FEEDBACK" ] && FB="The previous attempt FAILED the verifier. Feedback:
$(cat "$FEEDBACK")"

cd "$WORK" || { echo "aider: cannot enter workdir $WORK" >&2; exit 1; }
# editable source files to add to the chat (exclude protected gate/goal/tests + hidden/noise).
# bash-3.2-safe array build (macOS default bash has no mapfile).
FILES=()
while IFS= read -r f; do FILES+=("$f"); done < <(find . -type f \
  -not -path './node_modules/*' -not -path './.git/*' -not -name '.*' \
  -not -name 'verify.sh' -not -name 'TASK.md' -not -name 'task.yaml' \
  -not -name 'checkpoints.sh' -not -name 'policy.json' -not -name 'result.json' \
  -not -name '*.test.js' | sed 's|^\./||' | sort)

aider ${FILES[@]+"${FILES[@]}"} \
  --model "ollama_chat/$MODEL" \
  --no-git --no-auto-commits --yes-always --no-stream --no-pretty \
  --no-check-update --no-show-model-warnings \
  --message "Make this project's rules-based verifier (./verify.sh) pass.

TASK:
$TASK

$FB

Edit/create only the SOURCE or artifact files the task asks for. NEVER edit test files
(*.test.js), verify.sh, or TASK.md." >/dev/null 2>&1 || true
