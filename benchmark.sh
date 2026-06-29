#!/usr/bin/env bash
# benchmark.sh — the harness benchmark: run the whole task battery through every
# available harness on identical rules-based verifiers, then build the report.
#
# It is a thin orchestrator: compare.sh does the runs (writes results/comparison.md
# and populates .runs/ + runs.jsonl), then benchmark.js aggregates those into a
# profile table + scorecard at results/BENCHMARK.md (dimensions per Addy Osmani's
# "agent harness engineering"). Holds the model constant (local qwen3:8b) across the
# lean harnesses so the variable is the harness; claude (cloud) is the reference.
#
# Usage:
#   ./benchmark.sh                 # all installed lean harnesses (offline, $0)
#   RUN_CLAUDE=1 ./benchmark.sh    # also include Claude Opus 4.8 (spends tokens)
#   MAX_ITERS=2 ./benchmark.sh     # tighter recovery budget
#   ./benchmark.sh tasks/research-deck   # restrict to specific task(s)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "== benchmark: running the battery through every available harness =="
./compare.sh "$@"

echo
echo "== building results/BENCHMARK.md =="
node benchmark.js

echo
echo "================= results/BENCHMARK.md ================="
cat results/BENCHMARK.md
