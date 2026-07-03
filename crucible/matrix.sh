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

# §5A.1 host-health canary (the three-arm study showed wall-clock Goodput is NON-STATIONARY on a
# constrained host — swap growth collapsed throughput mid-battery). Before every cell we probe the
# model's generation rate + read swap, append both to a sidecar (<ledger>.canary.jsonl), and if the
# rate is below CANARY_MIN tok/s we unload the model and re-probe once. classify-timeouts.js joins
# the sidecar to attribute timeouts as HOST_DEGRADED. Probe failures are recorded, never fatal.
CANARY_MIN="${CANARY_MIN:-5}"
SIDECAR="${LEDGER%.jsonl}.canary.jsonl"
OLLAMA_PROBE="${OLLAMA_PROBE:-http://localhost:11434}"
probe_tok_s() {  # model -> prints tok/s ("" on failure); eval-rate only, so cold load doesn't skew it
  curl -s -m 30 "$OLLAMA_PROBE/api/generate" \
    -d "{\"model\":\"$1\",\"prompt\":\"2+2=\",\"stream\":false,\"options\":{\"num_predict\":16}}" 2>/dev/null |
  node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const r=JSON.parse(d);
    if(r.eval_count&&r.eval_duration)console.log((r.eval_count/(r.eval_duration/1e9)).toFixed(1))}catch{}})'
}
canary() {  # cellname model -> appends sidecar row; gates (unload+re-probe) when unhealthy
  local cellname="$1" m="$2" tok swap action="" tok2=""
  [ "$m" = "baseline" ] && return 0
  swap="$(sysctl -n vm.swapusage 2>/dev/null | awk '{print $6}')"
  tok="$(probe_tok_s "$m")"
  if [ -n "$tok" ] && [ "$(node -e "console.log($tok < $CANARY_MIN ? 1 : 0)")" = "1" ]; then
    action="unload_reprobe"; ollama stop "$m" >/dev/null 2>&1; sleep 3
    tok2="$(probe_tok_s "$m")"
  fi
  printf '{"ts":"%s","cell":"%s","model":"%s","tok_s":%s,"swap_used":"%s","action":"%s","tok_s_after":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$cellname" "$m" "${tok:-null}" "${swap:-?}" "$action" "${tok2:-null}" \
    >> "$SIDECAR"
}

echo "== Crucible battery ${RESUME:+(resume)} =="
echo "  tasks:    $TASKS"
echo "  adapters: $ADAPTERS"
echo "  models:   $MODELS"
echo "  ledger:   $LEDGER"
[ -n "${ORDER_SEED:-}" ] && echo "  order:    seeded shuffle (ORDER_SEED=$ORDER_SEED)"
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
  canary "$name.$a.$m.s$s" "$m"
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

# --- build the full cell list first (enables §5A.1 seeded order randomization) ----------------
# Cell line format: td|name|adapter|model|seed|max_iters|max_tokens|wall_to
CELLS=()
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
      CELLS+=("$td|$name|mock|baseline|0|$mi|0|$wt")       # model-agnostic floor: run once
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
      for s in "${SEED_ARR[@]}"; do CELLS+=("$td|$name|$a|$m|$s|$mi|$mt|$mwt"); done
    done
  done
done

# §5A.1 randomized cell order: with ORDER_SEED set, deterministic Fisher–Yates shuffle (seeded
# mulberry32) so host drift over a long battery is decorrelated from any task/harness/model block.
# The seed is recorded in the canary sidecar so the exact order is reproducible.
if [ -n "${ORDER_SEED:-}" ] && [ "${#CELLS[@]}" -gt 1 ]; then
  SHUFFLED="$(printf '%s\n' "${CELLS[@]}" | node -e '
    const seed = Number(process.argv[1]);
    let a = seed | 0; const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let d = ""; process.stdin.on("data", c => d += c).on("end", () => {
      const lines = d.split("\n").filter(Boolean);
      for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]]; }
      process.stdout.write(lines.join("\n"));
    });' "$ORDER_SEED")"
  CELLS=(); while IFS= read -r line; do CELLS+=("$line"); done <<< "$SHUFFLED"
  printf '{"ts":"%s","meta":"order","order_seed":%s,"n_cells":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ORDER_SEED" "${#CELLS[@]}" >> "$SIDECAR"
fi

for line in "${CELLS[@]}"; do
  IFS='|' read -r td name a m s mi mt mwt <<< "$line"
  cell "$td" "$name" "$a" "$m" "$s" "$mi" "$mt" "$mwt"
done

echo
echo "battery: $passed/$total ran-passed; $skipped skipped (resume); $timedout timed out; $errored errored"
echo "report:  node crucible/report.js \"$LEDGER\""
