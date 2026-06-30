#!/usr/bin/env bash
# matrix.sh — Crucible protocol runner (P2/P4/P9).
#
# Factorial: harness × model × seed over a task set, with EVERYTHING ELSE FIXED
# (prompt, fixtures, budgets, oracle), into ONE battery ledger that report.js aggregates.
# This is what makes a measured difference attributable to the harness, with variance.
#
# Usage (all via env, with defaults):
#   TASKS="tasks/hello-sum tasks/fizzbuzz" \
#   ADAPTERS="mock,ollama,hermes,pi" \
#   MODELS="deepseek-r1:1.5b,qwen3:8b" \
#   SEEDS="1,2,3" \                       # optional; else each task.yaml's seeds
#   LEDGER=crucible/results/battery.jsonl \
#   ./crucible/matrix.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TASKS="${TASKS:-tasks/hello-sum tasks/fizzbuzz}"
ADAPTERS="${ADAPTERS:-mock,ollama}"
MODELS="${MODELS:-deepseek-r1:1.5b,qwen3:8b}"
SEEDS="${SEEDS:-}"
LEDGER="${LEDGER:-$ROOT/crucible/results/battery.jsonl}"

mkdir -p "$(dirname "$LEDGER")"; : > "$LEDGER"
IFS=',' read -r -a ADA <<< "$ADAPTERS"
IFS=',' read -r -a MOD <<< "$MODELS"

echo "== Crucible battery =="
echo "  tasks:    $TASKS"
echo "  adapters: $ADAPTERS"
echo "  models:   $MODELS"
echo "  ledger:   $LEDGER"
echo

meta() { node "$ROOT/crucible/lib/taskmeta.js" "$1" "$2" 2>/dev/null; }
total=0; passed=0
cell() {  # task_dir adapter model seed max_iters max_tokens
  total=$((total+1))
  if CRUCIBLE=1 HARNESS_MODEL="$3" SEED="$4" MAX_TOKENS="$6" CRZ_LEDGER="$LEDGER" \
       "$ROOT/loop.sh" "$1" "$2" "$5" >/dev/null 2>&1; then passed=$((passed+1)); fi
  printf '  [%2d] %-22s %-8s %-18s seed=%s\n' "$total" "$(basename "$1")" "$2" "$3" "$4"
}

for task in $TASKS; do
  td="$ROOT/$task"; [ -d "$td" ] || td="$task"
  mi="$(meta "$td" budgets.max_iters)"; mi="${mi:-5}"
  mt="$(meta "$td" budgets.max_tokens)"; mt="${mt:-0}"
  seeds="$SEEDS"; [ -z "$seeds" ] && seeds="$(meta "$td" seeds)"; [ -z "$seeds" ] && seeds="1"
  IFS=',' read -r -a SEED_ARR <<< "$seeds"
  for a in "${ADA[@]}"; do
    if [ "$a" = "mock" ]; then
      cell "$td" mock baseline 0 "$mi" 0        # model-agnostic deterministic floor: run once
      continue
    fi
    for m in "${MOD[@]}"; do
      for s in "${SEED_ARR[@]}"; do cell "$td" "$a" "$m" "$s" "$mi" "$mt"; done
    done
  done
done

echo
echo "battery complete: $passed/$total cells passed verify"
echo "report:  node crucible/report.js \"$LEDGER\""
