#!/usr/bin/env bash
# run-openai-metered.sh — Phase B metered OpenAI arms (needs a real OPENAI_API_KEY).
#
# These two arms were prepared but NOT run in the Phase B session because no OpenAI API key was
# available (codex ran on a ChatGPT subscription; claude on a Pro login). Provide a key and run:
#
#   export OPENAI_API_KEY=sk-...
#   bash crucible/run-openai-metered.sh
#
# Arm 1 — aider @ gpt-4o-mini (text harness, metered): the §6.5 metered-cloud reference, scaled
#         to the discriminating tasks × 5 seeds. Routes proxy → api.openai.com so tokens/$ are real.
# Arm 2 — pi/hermes/goose @ gpt-4o-mini (tool-calling harnesses, metered): fills the H6 gap
#         ("we lack frontier tool-calling-harness data") AND de-confounds the H3a codex bookend —
#         if generic OpenAI-dialect tool-callers succeed on a protocol-capable cloud model that is
#         NOT codex's co-tuned native pairing, interface-fit (not a home-turf effect) is confirmed.
#
# Both route through the metering proxy (OLLAMA_UPSTREAM=https://api.openai.com), so tokens and
# cost land in the ledger exactly like the local battery. Cost is tiny (~$0.002/run at gpt-4o-mini
# in §6.5), but it IS real spend — hence key-gated and opt-in.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${OPENAI_API_KEY:?set OPENAI_API_KEY first (this arm makes real metered API calls)}"

MODEL="${MODEL:-gpt-4o-mini}"
SEEDS="${SEEDS:-1,2,3,4,5}"
TASKS="${TASKS:-crucible/tasks/tool-recover crucible/tasks/api-migration crucible/tasks/secret-redaction tasks/temp-convert}"
LEDGER="${LEDGER:-$ROOT/crucible/results/cloud-openai-metered.jsonl}"

echo "== Phase B metered OpenAI arms → $MODEL =="
# Routing is handled INSIDE the adapters: each reads OLLAMA_HOST (set by loop.sh to the per-run
# proxy) and points its OpenAI endpoint there; OLLAMA_UPSTREAM tells the proxy to forward to
# api.openai.com, so every request is metered on the way through. Only OPENAI_API_KEY +
# OLLAMA_UPSTREAM are needed here. CANARY_MIN=0 disables the local-Ollama health gate (cloud model).
export CANARY_MIN=0

echo "-- arm 1: aider (text harness, metered)"
TASKS="$TASKS" ADAPTERS=aider MODELS="$MODEL" SEEDS="$SEEDS" RESUME=1 \
  OLLAMA_UPSTREAM="https://api.openai.com" LEDGER="$LEDGER" bash "$ROOT/crucible/matrix.sh"

echo "-- arm 2: pi,hermes,goose (tool-calling harnesses, metered — H6 gap + H3a de-confound)"
TASKS="$TASKS" ADAPTERS=pi,hermes,goose MODELS="$MODEL" SEEDS="$SEEDS" RESUME=1 \
  OLLAMA_UPSTREAM="https://api.openai.com" LEDGER="$LEDGER" bash "$ROOT/crucible/matrix.sh"

node "$ROOT/crucible/report.js" "$LEDGER"
echo "done → $LEDGER (+ SCORECARD-$(basename "${LEDGER%.jsonl}").md)"
