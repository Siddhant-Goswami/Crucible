#!/usr/bin/env bash
# bench.sh — the canonical Crucible publishable battery. Records the environment for repro, runs
# the local harness × model × seed matrix (resumable + wall-timeout-bounded), optionally a Claude
# (Opus) frontier slice (RUN_CLAUDE=1, cloud $), then renders the scorecard.
#
#   ./crucible/bench.sh                # fresh local battery + report
#   RESUME=1 ./crucible/bench.sh       # resume an interrupted battery (skips recorded cells)
#   RUN_CLAUDE=1 ./crucible/bench.sh   # also run the Claude frontier slice (cloud token spend)
set -euo pipefail   # fail fast: a broken matrix/report must not fall through to a success line
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT" || exit 1
RESULTS="$ROOT/crucible/results"; mkdir -p "$RESULTS"
LEDGER="${LEDGER:-$RESULTS/battery.jsonl}"

LOCAL_HARNESSES="${LOCAL_HARNESSES:-mock,ollama,pi,hermes,goose,codex,aider}"
LOCAL_MODELS="${LOCAL_MODELS:-deepseek-r1:1.5b,qwen3:8b,deepseek-r1:8b}"
SEEDS="${SEEDS:-1,2,3}"
TASKS="${TASKS:-tasks/hello-sum tasks/fizzbuzz tasks/roman-numerals tasks/temp-convert tasks/research-deck tasks/self-improving-rubric crucible/tasks/secret-redaction crucible/tasks/tool-recover crucible/tasks/api-migration}"
# Claude frontier slice — a discriminating subset (bounds cloud $)
CLAUDE_TASKS="${CLAUDE_TASKS:-crucible/tasks/tool-recover crucible/tasks/api-migration crucible/tasks/secret-redaction tasks/temp-convert}"
CLAUDE_MODEL="${CLAUDE_MODEL:-claude-opus-4-8}"

# --- record the environment for reproducibility ------------------------------
{
  echo "# Crucible battery environment"
  echo
  echo "- date:      $(date -u +%FT%TZ)"
  echo "- host:      $(uname -srm)"
  echo "- node:      $(node -v)"
  echo "- ollama:    $(ollama --version 2>/dev/null | head -1)"
  echo "- harnesses: $LOCAL_HARNESSES"
  echo "- models:    $LOCAL_MODELS   seeds: $SEEDS"
  echo "- tasks:     $(echo $TASKS | wc -w | tr -d ' ')"
  echo
  echo "## local model digests"
  curl -s --max-time 5 http://localhost:11434/api/tags 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{for(const m of JSON.parse(s).models)console.log("- "+m.name+"  "+String(m.digest||"").slice(0,12)+"  "+((m.details&&m.details.parameter_size)||""))}catch{console.log("- (ollama not reachable)")}})' || true
} > "$RESULTS/ENV.md"
echo "recorded env -> ${RESULTS#"$ROOT"/}/ENV.md"

# --- local battery -----------------------------------------------------------
echo "=== local battery ==="
TASKS="$TASKS" ADAPTERS="$LOCAL_HARNESSES" MODELS="$LOCAL_MODELS" SEEDS="$SEEDS" \
  RESUME="${RESUME:-}" LEDGER="$LEDGER" bash "$ROOT/crucible/matrix.sh"

# --- Claude frontier slice (opt-in; cloud $) ---------------------------------
if [ -n "${RUN_CLAUDE:-}" ]; then
  echo "=== Claude frontier slice ($CLAUDE_MODEL) ==="
  RUN_CLAUDE=1 TASKS="$CLAUDE_TASKS" ADAPTERS="claude" MODELS="$CLAUDE_MODEL" SEEDS="$SEEDS" \
    RESUME=1 LEDGER="$LEDGER" bash "$ROOT/crucible/matrix.sh"
fi

# --- scorecard ---------------------------------------------------------------
echo "=== rendering scorecard ==="
node "$ROOT/crucible/report.js" "$LEDGER"
echo "done. scorecard -> ${RESULTS#"$ROOT"/}/SCORECARD.md ; env -> ${RESULTS#"$ROOT"/}/ENV.md"
