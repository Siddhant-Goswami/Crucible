#!/usr/bin/env bash
# matrix.sh — Crucible protocol runner (P2/P4/P9): factorial harness × model × seed over a task
# set, everything else fixed, into ONE battery ledger that report.js aggregates.
#
# RESUMABLE: RESUME=1 keeps the existing ledger and skips cells already recorded
#   (key = task|adapter|model|seed) — a long battery survives interruption.
# BOUNDED:   each cell is killed after the task's budgets.wall_timeout_s so a hung harness can't
#   stall the run; a timed-out cell is LOGGED (never silently dropped) and left absent so RESUME
#   retries it.
#
# Usage (env):
#   TASKS="tasks/hello-sum crucible/tasks/tool-recover" ADAPTERS="mock,ollama,pi" \
#   MODELS="deepseek-r1:1.5b,qwen3:8b" SEEDS="1,2,3" RESUME=1 \
#   LEDGER=crucible/results/battery.jsonl ./crucible/matrix.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TASKS="${TASKS:-tasks/hello-sum tasks/fizzbuzz}"
ADAPTERS="${ADAPTERS:-mock,ollama}"
MODELS="${MODELS:-deepseek-r1:1.5b,qwen3:8b}"
SEEDS="${SEEDS:-}"
RESUME="${RESUME:-}"
LEDGER="${LEDGER:-$ROOT/crucible/results/battery.jsonl}"

mkdir -p "$(dirname "$LEDGER")"
[ -n "$RESUME" ] || : > "$LEDGER"          # truncate only on a fresh run
touch "$LEDGER"
IFS=',' read -r -a ADA <<< "$ADAPTERS"
IFS=',' read -r -a MOD <<< "$MODELS"

echo "== Crucible battery ${RESUME:+(resume)} =="
echo "  tasks:    $TASKS"
echo "  adapters: $ADAPTERS"
echo "  models:   $MODELS"
echo "  ledger:   $LEDGER"
echo

meta() { node "$ROOT/crucible/lib/taskmeta.js" "$1" "$2" 2>/dev/null; }

# is a (task,adapter,model,seed) cell already recorded? (resume + timeout detection)
seen() {  # task adapter model seed
  [ -s "$LEDGER" ] || return 1
  node -e 'const fs=require("fs");const[L,t,a,m,s]=process.argv.slice(1);
    const rows=fs.readFileSync(L,"utf8").split("\n").filter(Boolean);
    process.exit(rows.some(l=>{try{const r=JSON.parse(l);return r.task===t&&r.adapter===a&&String(r.model)===m&&String(r.seed)===s}catch{return false}})?0:1)' \
    "$LEDGER" "$1" "$2" "$3" "$4"
}

# portable per-cell watchdog (macOS has no `timeout`): kill loop.sh + its children on overrun.
run_timed() {  # secs cmd...
  local secs="$1"; shift
  if [ "${secs:-0}" -le 0 ]; then "$@"; return $?; fi
  "$@" & local pid=$!
  ( sleep "$secs"
    if kill -0 "$pid" 2>/dev/null; then
      pkill -P "$pid" 2>/dev/null; kill -TERM "$pid" 2>/dev/null
      sleep 2; pkill -9 -P "$pid" 2>/dev/null; kill -9 "$pid" 2>/dev/null
    fi ) & local w=$!
  wait "$pid" 2>/dev/null; local rc=$?
  kill "$w" 2>/dev/null; wait "$w" 2>/dev/null
  return $rc
}

total=0; passed=0; skipped=0; timedout=0
cell() {  # task_dir name adapter model seed max_iters max_tokens wall_to
  local td="$1" name="$2" a="$3" m="$4" s="$5" mi="$6" mt="$7" wt="$8" mark
  if [ -n "$RESUME" ] && seen "$name" "$a" "$m" "$s"; then
    skipped=$((skipped+1)); printf '  [skip] %-20s %-8s %-18s seed=%s\n' "$name" "$a" "$m" "$s"; return
  fi
  total=$((total+1))
  if run_timed "$wt" env CRUCIBLE=1 HARNESS_MODEL="$m" SEED="$s" MAX_TOKENS="$mt" CRZ_LEDGER="$LEDGER" \
       bash "$ROOT/loop.sh" "$td" "$a" "$mi" >/dev/null 2>&1; then
    passed=$((passed+1)); mark="ok"
  else
    mark="x"
  fi
  # killed before finalize => no ledger record => count + flag the timeout (not silent)
  if ! seen "$name" "$a" "$m" "$s"; then timedout=$((timedout+1)); mark="TIMEOUT"; fi
  pkill -f 'ollama-proxy.js' 2>/dev/null    # reap any orphan proxy before the next cell
  printf '  [%3d] %-7s %-20s %-8s %-18s seed=%s\n' "$total" "$mark" "$name" "$a" "$m" "$s"
}

for task in $TASKS; do
  td="$ROOT/$task"; [ -d "$td" ] || td="$task"
  name="$(basename "$td")"
  mi="$(meta "$td" budgets.max_iters)"; mi="${mi:-5}"
  mt="$(meta "$td" budgets.max_tokens)"; mt="${mt:-0}"
  wt="$(meta "$td" budgets.wall_timeout_s)"; wt="${wt:-0}"
  seeds="$SEEDS"; [ -z "$seeds" ] && seeds="$(meta "$td" seeds)"; [ -z "$seeds" ] && seeds="1"
  IFS=',' read -r -a SEED_ARR <<< "$seeds"
  for a in "${ADA[@]}"; do
    if [ "$a" = "mock" ]; then
      cell "$td" "$name" mock baseline 0 "$mi" 0 "$wt"      # model-agnostic floor: run once
      continue
    fi
    for m in "${MOD[@]}"; do
      for s in "${SEED_ARR[@]}"; do cell "$td" "$name" "$a" "$m" "$s" "$mi" "$mt" "$wt"; done
    done
  done
done

echo
echo "battery: $passed/$total ran-passed; $skipped skipped (resume); $timedout timed out"
echo "report:  node crucible/report.js \"$LEDGER\""
