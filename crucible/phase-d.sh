#!/usr/bin/env bash
# phase-d.sh — Phase D confirmatory arm: the THIRD local model family (Llama, via llama3.2:3b),
# per the pre-registered design in docs/crucible-hypotheses.md §5.1 (≥3 families) + §5A
# (per-model timeout fits, seeded cell shuffle, host-health canary), at 5 seeds (§5.3) over the
# full battery INCLUDING the hardened T1 tier (§5A.6: tool-recover [nonce+sha256],
# tool-recover-lock, tool-recover-config).
#
#   ./crucible/phase-d.sh calibrate   # 1) T0 calibration slice for llama3.2:3b + re-fit timeouts
#   ./crucible/phase-d.sh start       # 2) launch the full arm, detached + caffeinated (resumable)
#   ./crucible/phase-d.sh status      #    watch it
#   ./crucible/phase-d.sh stop        #    stop it (ledger intact; start resumes)
#
# Pre-registered config (frozen 2026-07-18, before any Phase D confirmatory cell was run):
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MODEL="llama3.2:3b"                       # third family: Meta Llama (vs qwen*, deepseek-r1*)
SEEDS="1,2,3,4,5"                         # §5.3: ≥5 seeds
HARNESSES="mock,ollama,pi,hermes,goose,codex,aider"
TASKS="tasks/hello-sum tasks/fizzbuzz tasks/roman-numerals tasks/temp-convert \
tasks/research-deck tasks/self-improving-rubric crucible/tasks/secret-redaction \
crucible/tasks/api-migration crucible/tasks/tool-recover \
crucible/tasks/tool-recover-lock crucible/tasks/tool-recover-config"
LEDGER="$ROOT/crucible/results/phase-d-llama.jsonl"
CALIB="$ROOT/crucible/results/llama-t0-calib.jsonl"
ORDER_SEED=42                             # §5A.1: seeded shuffle, recorded in the canary sidecar

case "${1:-start}" in
  calibrate)
    echo "== Phase D calibration: T0 slice for $MODEL =="
    TASKS="tasks/hello-sum tasks/fizzbuzz tasks/roman-numerals" \
      ADAPTERS=ollama MODELS="$MODEL" SEEDS="1,2,3" RESUME=1 LEDGER="$CALIB" \
      bash "$ROOT/crucible/matrix.sh"
    echo "== re-fitting timeouts (all calibration sources) =="
    node "$ROOT/crucible/tools/fit-timeouts.js" \
      "$ROOT/crucible/results/battery.published.jsonl" \
      "$ROOT/crucible/results/qwen35-t0-calib.jsonl" \
      "$CALIB"
    ;;
  start)
    if ! node -e "const f=require('$ROOT/crucible/results/timeout-fits.json').fits['$MODEL'];process.exit(f?0:1)" 2>/dev/null; then
      echo "no timeout fit for $MODEL yet — run './crucible/phase-d.sh calibrate' first" >&2; exit 1
    fi
    LOCAL_HARNESSES="$HARNESSES" LOCAL_MODELS="$MODEL" SEEDS="$SEEDS" \
      TASKS="$TASKS" LEDGER="$LEDGER" ORDER_SEED="$ORDER_SEED" RESUME=1 \
      bash "$ROOT/crucible/run-detached.sh" start
    ;;
  status|stop)
    bash "$ROOT/crucible/run-detached.sh" "$1"
    ;;
  *) echo "usage: $0 {calibrate|start|status|stop}" >&2; exit 1 ;;
esac
