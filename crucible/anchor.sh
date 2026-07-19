#!/usr/bin/env bash
# anchor.sh — Sprint 2 external-anchor battery (S2.2): the installed harnesses × the two headline
# local models × the imported Terminal-Bench slice (crucible/tasks/anchored), under the same §5A
# hardening as Phase D (per-model wall-timeout fit as a floor, seeded cell shuffle, host-health
# canary). This is the external-validity check on the homegrown battery (crucible-related-work.md §4).
#
#   ./crucible/anchor.sh calibrate   # 1) refresh T0 wall-timeout fits for the two anchor models
#   ./crucible/anchor.sh start       # 2) launch the full anchor battery, detached + caffeinated
#   ./crucible/anchor.sh status      #    watch it
#   ./crucible/anchor.sh stop        #    stop it (ledger intact; start resumes)
#   ./crucible/anchor.sh report      #    (re-)render the scorecard from the ledger
#
# Pre-registered config (frozen 2026-07-19, before any anchor cell was run):
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MODELS="qwen3.5:9b,llama3.2:3b"           # the two headline local models (size ladder top + 3rd family)
SEEDS="1,2,3"                             # §5.3: 3 seeds for the anchor slice
HARNESSES="mock,ollama,pi,hermes,goose,codex,aider"
TASKS="$(printf 'crucible/tasks/anchored/%s ' \
  tb-hello-world tb-fix-permissions tb-countdown-game tb-regex-log tb-jsonl-aggregator \
  tb-recover-obfuscated-files tb-analyze-access-logs tb-mahjong-winninghand \
  tb-recover-accuracy-log tb-schemelike-metacircular-eval)"
LEDGER="$ROOT/crucible/results/anchor-tb.jsonl"
CALIB="$ROOT/crucible/results/anchor-t0-calib.jsonl"
ORDER_SEED=42                             # §5A.1: seeded shuffle, recorded in the canary sidecar

case "${1:-start}" in
  calibrate)
    echo "== anchor calibration: T0 slice for $MODELS =="
    TASKS="tasks/hello-sum tasks/fizzbuzz tasks/roman-numerals" \
      ADAPTERS=ollama MODELS="$MODELS" SEEDS="1,2,3" RESUME=1 LEDGER="$CALIB" \
      bash "$ROOT/crucible/matrix.sh"
    echo "== re-fitting timeouts (all calibration sources) =="
    node "$ROOT/crucible/tools/fit-timeouts.js" \
      "$ROOT/crucible/results/battery.published.jsonl" \
      "$ROOT/crucible/results/qwen35-t0-calib.jsonl" \
      "$ROOT/crucible/results/llama-t0-calib.jsonl" \
      "$CALIB"
    ;;
  start)
    for m in ${MODELS//,/ }; do
      if ! node -e "const f=require('$ROOT/crucible/results/timeout-fits.json').fits['$m'];process.exit(f?0:1)" 2>/dev/null; then
        echo "no timeout fit for $m yet — run './crucible/anchor.sh calibrate' first" >&2; exit 1
      fi
    done
    LOCAL_HARNESSES="$HARNESSES" LOCAL_MODELS="$MODELS" SEEDS="$SEEDS" \
      TASKS="$TASKS" LEDGER="$LEDGER" ORDER_SEED="$ORDER_SEED" RESUME=1 \
      bash "$ROOT/crucible/run-detached.sh" start
    ;;
  status|stop)
    bash "$ROOT/crucible/run-detached.sh" "$1"
    ;;
  report)
    node "$ROOT/crucible/report.js" "$LEDGER"
    ;;
  *) echo "usage: $0 {calibrate|start|status|stop|report}" >&2; exit 1 ;;
esac
