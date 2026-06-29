#!/usr/bin/env bash
# loop.sh — a harness-AGNOSTIC bounded agent loop.
#
# This is the whole thesis of 100x-loops, made portable across harnesses:
#
#     act  ->  verify (rules-based)  ->  exit 0 (done) | exit 2 (keep going)  ->  repeat
#
# The 100x-loops bake the "act" step into Claude Code (a Stop hook re-runs the
# verifier on every turn). Here we INVERT control: the shell owns the loop and
# calls a swappable ADAPTER for the "act" step, so we can drop in any harness
# (mock | ollama | claude | hermes | nemo) behind the exact same contract and
# compare them on the exact same verifier.
#
# Usage:
#   ./loop.sh <task-dir> <adapter> [max_iters]
#
#   task-dir   a folder containing TASK.md (the goal) + verify.sh (the gate)
#   adapter    name of adapters/<adapter>.sh
#   max_iters  hard cap on iterations (default 5) — the guardrail; NEVER unbounded
#
# Adapter contract (every adapters/*.sh must honor it):
#   adapters/<adapter>.sh <workdir> <iter> <feedback-file>
#     - read the goal from <workdir>/TASK.md
#     - read prior verifier feedback from <feedback-file> (may be empty on iter 1)
#     - make ONE attempt: edit files inside <workdir>
#
# Safety properties (mirrors the 100x-loops conventions):
#   - BOUNDED: max_iters caps every run; no infinite loops.
#   - SANDBOXED side effects: we operate on a throwaway COPY in .runs/, never the
#     pristine task. The original task-dir is read-only as far as the loop cares.
#   - OBSERVABLE: every iteration's adapter time + verifier verdict is logged.
#
# Output: prints a one-line RESULT record and writes .runs/<run>/result.json
set -uo pipefail

TASK_DIR="${1:?usage: loop.sh <task-dir> <adapter> [max_iters]}"
ADAPTER="${2:?usage: loop.sh <task-dir> <adapter> [max_iters]}"
MAX_ITERS="${3:-5}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK_DIR="$(cd "$TASK_DIR" && pwd)"
TASK_NAME="$(basename "$TASK_DIR")"
ADAPTER_SH="$ROOT/adapters/${ADAPTER}.sh"

[ -f "$ADAPTER_SH" ]        || { echo "no such adapter: $ADAPTER_SH" >&2; exit 1; }
[ -f "$TASK_DIR/verify.sh" ] || { echo "task has no verify.sh: $TASK_DIR" >&2; exit 1; }

# --- sandbox: copy the task into a disposable workdir --------------------------
RUN_ID="${TASK_NAME}.${ADAPTER}"
WORK="$ROOT/.runs/$RUN_ID"
rm -rf "$WORK"; mkdir -p "$WORK"
cp -R "$TASK_DIR/." "$WORK/"
chmod +x "$WORK/verify.sh" 2>/dev/null || true
FEEDBACK="$WORK/.feedback"
: > "$FEEDBACK"

# --- integrity guard: enforce the protected-file contract OUTSIDE the prompt ----
# Every adapter's prompt asks the agent not to touch the gate, the goal, or the
# tests — but a prompt is advisory, so a harness could be marked "passed" by simply
# rewriting verify.sh/TASK.md/*.test.js. Before each verify we RESTORE those files
# from the pristine task, so no harness can pass without actually solving the task.
# Lives once here (review's recommendation) rather than duplicated per adapter.
restore_protected() {
  local rel
  while IFS= read -r rel; do
    rel="${rel#./}"
    [ -z "$rel" ] && continue
    if [ -f "$WORK/$rel" ] && ! cmp -s "$TASK_DIR/$rel" "$WORK/$rel"; then
      echo "  [iter $iter] integrity: restored protected file '$rel' (adapter modified it)" >&2
    fi
    mkdir -p "$WORK/$(dirname "$rel")"
    cp "$TASK_DIR/$rel" "$WORK/$rel"
  done < <(cd "$TASK_DIR" && find . -type f \
    \( -name 'verify.sh' -o -name 'TASK.md' -o -name '*.test.js' \
       -o -name '*_test.js' -o -name '*-test.js' -o -name 'test.js' \) | sort)
  chmod +x "$WORK/verify.sh" 2>/dev/null || true
}

# portable millisecond clock (works without GNU date)
now_ms() { node -e 'process.stdout.write(String(Date.now()))'; }

echo "== loop ==  task=$TASK_NAME  adapter=$ADAPTER  max_iters=$MAX_ITERS"
run_start="$(now_ms)"
result="failed"; used_iters=0; act_ms_total=0

for ((iter=1; iter<=MAX_ITERS; iter++)); do
  used_iters="$iter"

  # ---- ACT: hand the attempt to the swappable harness ----------------------
  a0="$(now_ms)"
  if ! bash "$ADAPTER_SH" "$WORK" "$iter" "$FEEDBACK"; then
    echo "  [iter $iter] adapter '$ADAPTER' returned nonzero (continuing to verify anyway)" >&2
  fi
  a1="$(now_ms)"
  act_ms=$(( a1 - a0 )); act_ms_total=$(( act_ms_total + act_ms ))

  # restore the gate/goal/tests from the pristine task before trusting the gate
  restore_protected

  # ---- VERIFY: the rules-based gate decides done / keep-going ---------------
  if fb="$(cd "$WORK" && ./verify.sh 2>&1)"; then
    echo "  [iter $iter] act=${act_ms}ms  VERIFY: pass ✅  -> DONE"
    result="passed"
    break
  else
    printf '%s\n' "$fb" > "$FEEDBACK"
    echo "  [iter $iter] act=${act_ms}ms  VERIFY: fail ❌  -> feeding back, retrying"
  fi
done

run_end="$(now_ms)"
wall_ms=$(( run_end - run_start ))

# token usage, if the adapter recorded any (e.g. ollama)
tok_in=0; tok_out=0
[ -f "$WORK/.tokens" ] && read -r tok_in tok_out < "$WORK/.tokens"
NODE="${NODE:-local}"
ts="$(node -e 'process.stdout.write(new Date().toISOString())')"

# --- emit machine-readable result ---------------------------------------------
cat > "$WORK/result.json" <<JSON
{
  "ts": "$ts",
  "node": "$NODE",
  "task": "$TASK_NAME",
  "adapter": "$ADAPTER",
  "result": "$result",
  "iterations": $used_iters,
  "max_iters": $MAX_ITERS,
  "wall_ms": $wall_ms,
  "act_ms_total": $act_ms_total,
  "tokens_in": $tok_in,
  "tokens_out": $tok_out
}
JSON

# append to the central ledger the control plane + cost.js read
jq -c . "$WORK/result.json" >> "$ROOT/runs.jsonl"

echo "RESULT task=$TASK_NAME adapter=$ADAPTER result=$result iters=$used_iters wall_ms=$wall_ms tokens=${tok_in}/${tok_out}"
[ "$result" = "passed" ]
