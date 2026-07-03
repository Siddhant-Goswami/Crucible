#!/usr/bin/env bash
# matrix.sh — Crucible protocol runner (P2/P4/P9): factorial harness × model × seed over a task
# set, everything else fixed, into ONE battery ledger that report.js aggregates.
#
# RESUMABLE: RESUME=1 keeps the existing ledger and skips cells already recorded
#   (key = task|adapter|model|seed) — a long battery survives interruption.
# BOUNDED:   each cell is killed after the task's budgets.wall_timeout_s so a hung harness can't
#   stall the run; a real timeout is recorded as a stub (counted, and SKIPPED — not re-run — on
#   RESUME), while a no-record CRASH is surfaced separately (ERR) and left for RESUME to retry.
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
# Returns 124 IFF the watchdog actually fired (so cell() can tell a real timeout from a crash);
# the watchdog's `pkill -P` also reaps the cell's own proxy without a host-wide kill.
run_timed() {  # secs cmd...
  local secs="$1"; shift
  if [ "${secs:-0}" -le 0 ]; then "$@"; return $?; fi
  local flag="${TMPDIR:-/tmp}/cru-timeout.$$"; rm -f "$flag"
  "$@" & local pid=$!
  ( sleep "$secs"
    if kill -0 "$pid" 2>/dev/null; then
      : > "$flag"                                       # mark: the watchdog fired
      pkill -P "$pid" 2>/dev/null; kill -TERM "$pid" 2>/dev/null
      sleep 2; pkill -9 -P "$pid" 2>/dev/null; kill -9 "$pid" 2>/dev/null
    fi ) & local w=$!
  wait "$pid" 2>/dev/null; local rc=$?
  kill "$w" 2>/dev/null; wait "$w" 2>/dev/null
  if [ -f "$flag" ]; then rm -f "$flag"; return 124; fi  # 124 = timed out (GNU timeout convention)
  return $rc
}

total=0; passed=0; skipped=0; timedout=0; errored=0
cell() {  # task_dir name adapter model seed max_iters max_tokens wall_to
  local td="$1" name="$2" a="$3" m="$4" s="$5" mi="$6" mt="$7" wt="$8" mark rc
  if [ -n "$RESUME" ] && seen "$name" "$a" "$m" "$s"; then
    skipped=$((skipped+1)); printf '  [skip] %-20s %-8s %-18s seed=%s\n' "$name" "$a" "$m" "$s"; return
  fi
  total=$((total+1))
  run_timed "$wt" env CRUCIBLE=1 HARNESS_MODEL="$m" SEED="$s" MAX_TOKENS="$mt" CRZ_LEDGER="$LEDGER" \
    bash "$ROOT/loop.sh" "$td" "$a" "$mi" >/dev/null 2>&1
  rc=$?
  if [ "$rc" -eq 124 ]; then
    # the watchdog fired: record a timeout stub (counted + shown; a RESUME skips it, not re-runs).
    timedout=$((timedout+1)); mark="TIMEOUT"
    node "$ROOT/crucible/lib/timeout-stub.js" "$name" "$a" "$m" "$s" >> "$LEDGER"
  elif seen "$name" "$a" "$m" "$s"; then
    if [ "$rc" -eq 0 ]; then passed=$((passed+1)); mark="ok"; else mark="x"; fi
  else
    # ran (not a timeout) but wrote no ledger row => crash / setup failure, distinct from a
    # timeout. Surface it; leave it unrecorded so a RESUME retries it (it may be transient).
    errored=$((errored+1)); mark="ERR"
  fi
  printf '  [%3d] %-7s %-20s %-8s %-18s seed=%s\n' "$total" "$mark" "$name" "$a" "$m" "$s"
}

for task in $TASKS; do
  td="$ROOT/$task"; [ -d "$td" ] || td="$task"
  name="$(basename "$td")"
  mi="$(meta "$td" budgets.max_iters)"; mi="${mi:-5}"
  mt="$(meta "$td" budgets.max_tokens)"; mt="${mt:-0}"
  wt="$(meta "$td" budgets.wall_timeout_s)"; wt="${wt:-0}"
  [ -n "${WALL_TIMEOUT_OVERRIDE:-}" ] && wt="$WALL_TIMEOUT_OVERRIDE"   # shorten timeouts (e.g. fast-fail hang-prone cells)
  seeds="$SEEDS"; [ -z "$seeds" ] && seeds="$(meta "$td" seeds)"; [ -z "$seeds" ] && seeds="1"
  IFS=',' read -r -a SEED_ARR <<< "$seeds"
  for a in "${ADA[@]}"; do
    if [ "$a" = "mock" ]; then
      cell "$td" "$name" mock baseline 0 "$mi" 0 "$wt"      # model-agnostic floor: run once
      continue
    fi
    for m in "${MOD[@]}"; do
      # §5A.1 per-(model,host) wall-timeout fit: results/timeout-fits.json (fit-timeouts.js) is a
      # model-conditioned FLOOR — effective wt = max(task wt, fit). Slow models gain budget so
      # Goodput stops baking host/model latency into the score; absent/UNFIT models keep task wt.
      mwt="$wt"
      if [ -z "${WALL_TIMEOUT_OVERRIDE:-}" ] && [ -f "$ROOT/crucible/results/timeout-fits.json" ]; then
        fit="$(node -e "try{const f=require('$ROOT/crucible/results/timeout-fits.json').fits['$m'];if(f)console.log(f)}catch{}" 2>/dev/null)"
        [ -n "$fit" ] && [ "$fit" -gt "$mwt" ] 2>/dev/null && mwt="$fit"
      fi
      for s in "${SEED_ARR[@]}"; do cell "$td" "$name" "$a" "$m" "$s" "$mi" "$mt" "$mwt"; done
    done
  done
done

echo
echo "battery: $passed/$total ran-passed; $skipped skipped (resume); $timedout timed out; $errored errored"
echo "report:  node crucible/report.js \"$LEDGER\""
