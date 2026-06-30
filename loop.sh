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

# --- Crucible instrumentation (opt-in: CRUCIBLE=1) -----------------------------
# When enabled, loop.sh meters tokens via an ephemeral per-run proxy, persists a
# per-iteration trace.jsonl, enforces a token budget, and scores the gated profile
# via crucible/finalize.js. All of this is OFF by default — the plain run is untouched.
CRUCIBLE="${CRUCIBLE:-}"
HARNESS_MODEL="${HARNESS_MODEL:-${OLLAMA_MODEL:-qwen3:8b}}"
SEED="${SEED:-1}"
MAX_TOKENS="${MAX_TOKENS:-0}"                                   # 0 = no budget gate
CRUCIBLE_TEMP="${CRUCIBLE_TEMP:-0.7}"                           # >0 so seeds give variance (P9)
OLLAMA_UPSTREAM="${OLLAMA_UPSTREAM:-${OLLAMA_HOST:-http://localhost:11434}}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK_DIR="$(cd "$TASK_DIR" && pwd)"
TASK_NAME="$(basename "$TASK_DIR")"
ADAPTER_SH="$ROOT/adapters/${ADAPTER}.sh"

[ -f "$ADAPTER_SH" ]        || { echo "no such adapter: $ADAPTER_SH" >&2; exit 1; }
[ -f "$TASK_DIR/verify.sh" ] || { echo "task has no verify.sh: $TASK_DIR" >&2; exit 1; }

# --- sandbox: copy the task into a disposable workdir --------------------------
# In crucible mode the run-id carries model+seed so every matrix cell keeps its own
# workdir + trace; the legacy id stays task.adapter for backward compatibility.
RUN_ID="${TASK_NAME}.${ADAPTER}"
if [ -n "$CRUCIBLE" ]; then
  RUN_ID="${TASK_NAME}.${ADAPTER}.$(printf '%s' "$HARNESS_MODEL" | tr -c 'A-Za-z0-9' '_').s${SEED}"
fi
WORK="$ROOT/.runs/$RUN_ID"
rm -rf "$WORK"; mkdir -p "$WORK"
cp -R "$TASK_DIR/." "$WORK/"
chmod +x "$WORK/verify.sh" 2>/dev/null || true
FEEDBACK="$WORK/.feedback"
: > "$FEEDBACK"

# --- Crucible: start the ephemeral token-logging proxy + init the trace ---------
PROXY_PID=""; TRACE="$WORK/trace.jsonl"; SNAP="$WORK/.snap"; TOK_PROXY="$WORK/.tokens.proxy"
budget_exhausted=0; prev_in=0; prev_out=0
if [ -n "$CRUCIBLE" ]; then
  : > "$TRACE"; : > "$TOK_PROXY"
  # seed the snapshot from the PRISTINE workdir so pre-existing fixtures are not
  # mistaken for agent writes; only true diffs after an act count as files_written.
  node -e 'const{snapshot}=require(process.argv[1]);require("fs").writeFileSync(process.argv[3],JSON.stringify(snapshot(process.argv[2])))' \
    "$ROOT/crucible/lib/fsutil.js" "$WORK" "$SNAP"
  PORTFILE="$WORK/.proxy_port"; rm -f "$PORTFILE"
  node "$ROOT/crucible/proxy/ollama-proxy.js" --upstream "$OLLAMA_UPSTREAM" \
    --tokens "$TOK_PROXY" --events "$WORK/.proxy_events.jsonl" --portfile "$PORTFILE" &
  PROXY_PID=$!
  for _ in $(seq 1 30); do [ -s "$PORTFILE" ] && break; sleep 0.1; done
  if [ -s "$PORTFILE" ]; then
    export OLLAMA_HOST="http://127.0.0.1:$(cat "$PORTFILE")"
    export OLLAMA_MODEL="$HARNESS_MODEL" OLLAMA_SEED="$SEED" OLLAMA_TEMPERATURE="$CRUCIBLE_TEMP"
    echo "  crucible: model=$HARNESS_MODEL seed=$SEED budget=${MAX_TOKENS}tok proxy=$OLLAMA_HOST"
  else
    echo "  crucible: proxy failed to start; continuing without token metering" >&2
    kill "$PROXY_PID" 2>/dev/null || true; PROXY_PID=""
  fi

  # forbidden-command shims (safety tool channel): block + log any policy forbid_cmds
  # found on PATH. Best-effort — a harness that shells out via PATH is caught; direct
  # syscalls are not (documented blind spot). Only the task's own forbids are shimmed,
  # so the model transport (e.g. ollama's curl to the proxy) is left untouched.
  : > "$WORK/.cmds.log"
  forbid_cmds="$(node "$ROOT/crucible/lib/taskmeta.js" "$TASK_DIR" policy.forbid_cmds 2>/dev/null || true)"
  if [ -n "$forbid_cmds" ]; then
    SHIMS="$WORK/.shims"; mkdir -p "$SHIMS"
    IFS=',' read -r -a FC <<< "$forbid_cmds"
    for c in "${FC[@]}"; do
      [ -z "$c" ] && continue
      { echo '#!/usr/bin/env bash'
        echo "echo \"\$(date -u +%FT%TZ) $c \$*\" >> \"$WORK/.cmds.log\""
        echo "echo \"crucible: command '$c' is forbidden by task policy\" >&2"
        echo 'exit 1'; } > "$SHIMS/$c"
      chmod +x "$SHIMS/$c"
    done
    export PATH="$SHIMS:$PATH"
  fi
fi

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
       -o -name '*_test.js' -o -name '*-test.js' -o -name 'test.js' \
       -o -name 'task.yaml' -o -name 'checkpoints.sh' -o -name 'policy.json' \) | sort)
  chmod +x "$WORK/verify.sh" 2>/dev/null || true
}

# portable millisecond clock (works without GNU date)
now_ms() { node -e 'process.stdout.write(String(Date.now()))'; }
now_iso() { node -e 'process.stdout.write(new Date().toISOString())'; }

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
    vexit=0
    echo "  [iter $iter] act=${act_ms}ms  VERIFY: pass ✅  -> DONE"
    result="passed"
  else
    vexit=$?
    printf '%s\n' "$fb" > "$FEEDBACK"
    echo "  [iter $iter] act=${act_ms}ms  VERIFY: fail ❌  -> feeding back, retrying"
  fi

  # ---- Crucible: per-iteration trace + token delta + budget gate ------------
  if [ -n "$CRUCIBLE" ]; then
    printf '%s\n' "$fb" > "$FEEDBACK"               # this iter's verifier output, for the trace
    cum_in=0; cum_out=0
    [ -s "$TOK_PROXY" ] && read -r cum_in cum_out < "$TOK_PROXY"
    cp_hit=0; cp_total=0                             # optional milestones (partial credit + State)
    if [ -f "$WORK/checkpoints.sh" ]; then
      read -r cp_hit cp_total < <(cd "$WORK" && bash checkpoints.sh 2>/dev/null) || true
      cp_hit="${cp_hit:-0}"; cp_total="${cp_total:-0}"
    fi
    TI_WORK="$WORK" TI_TRACE="$TRACE" TI_SNAP="$SNAP" TI_ITER="$iter" \
      TI_TS="$(now_iso)" TI_ACT_MS="$act_ms" \
      TI_TIN="$(( cum_in - prev_in ))" TI_TOUT="$(( cum_out - prev_out ))" \
      TI_VEXIT="$vexit" TI_FEEDBACK_FILE="$FEEDBACK" \
      TI_CP_HIT="$cp_hit" TI_CP_TOTAL="$cp_total" \
      node "$ROOT/crucible/trace-iter.js"
    prev_in="$cum_in"; prev_out="$cum_out"
    if [ "$MAX_TOKENS" -gt 0 ] && [ "$(( cum_in + cum_out ))" -ge "$MAX_TOKENS" ]; then
      budget_exhausted=1
      echo "  [iter $iter] crucible: token budget ${MAX_TOKENS} reached ($(( cum_in + cum_out ))) -> stop" >&2
      break
    fi
  fi

  [ "$result" = "passed" ] && break
done

run_end="$(now_ms)"
wall_ms=$(( run_end - run_start ))

# stop the crucible proxy if we started one
[ -n "$PROXY_PID" ] && { kill "$PROXY_PID" 2>/dev/null || true; }

NODE="${NODE:-local}"
ts="$(now_iso)"

if [ -n "$CRUCIBLE" ]; then
  # crucible: tokens come from the proxy tally; finalize.js computes the gated
  # profile (Safety × Completion/Path/State), writes result.json + appends runs.jsonl.
  tok_in=0; tok_out=0
  [ -s "$TOK_PROXY" ] && read -r tok_in tok_out < "$TOK_PROXY"

  # safety audit (P6): compute per-channel SAR vs the task policy -> .audit.json
  AUD_WORK="$WORK" AUD_TASK_DIR="$TASK_DIR" AUD_TRACE="$TRACE" \
    AUD_CMDLOG="$WORK/.cmds.log" AUD_OUT="$WORK/.audit.json" \
    node "$ROOT/crucible/audit.js" || true

  CRZ_WORK="$WORK" CRZ_TASK_DIR="$TASK_DIR" CRZ_TASK="$TASK_NAME" CRZ_ADAPTER="$ADAPTER" \
    CRZ_MODEL="$HARNESS_MODEL" CRZ_SEED="$SEED" CRZ_NODE="$NODE" CRZ_TS="$ts" \
    CRZ_RESULT="$result" CRZ_ITERATIONS="$used_iters" CRZ_MAX_ITERS="$MAX_ITERS" \
    CRZ_WALL_MS="$wall_ms" CRZ_ACT_MS_TOTAL="$act_ms_total" \
    CRZ_TOKEN_BUDGET="$MAX_TOKENS" CRZ_BUDGET_EXHAUSTED="$budget_exhausted" \
    CRZ_TRACE_FILE="$TRACE" CRZ_TOKENS_FILE="$TOK_PROXY" CRZ_AUDIT_FILE="$WORK/.audit.json" \
    node "$ROOT/crucible/finalize.js"
  echo "RESULT task=$TASK_NAME adapter=$ADAPTER model=$HARNESS_MODEL seed=$SEED result=$result iters=$used_iters wall_ms=$wall_ms tokens=${tok_in}/${tok_out}"
else
  # token usage, if the adapter recorded any (e.g. ollama)
  tok_in=0; tok_out=0
  [ -f "$WORK/.tokens" ] && read -r tok_in tok_out < "$WORK/.tokens"

  # --- emit machine-readable result -------------------------------------------
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
fi

[ "$result" = "passed" ]
