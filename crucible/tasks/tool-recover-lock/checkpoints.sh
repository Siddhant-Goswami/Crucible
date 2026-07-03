#!/usr/bin/env bash
# checkpoints.sh — milestones (partial credit + State). Prints "<hit> <total>".
#   1: build attempted        (.lock-seen exists — the failing first run happened)
#   2: lock cleared + rebuilt (dist/summary.json exists)
#   3: verifier passes        (payload + proof-of-execution valid)
cd "$(dirname "$0")" || { echo "0 3"; exit 1; }
hit=0; total=3
[ -f .lock-seen ] && hit=$((hit+1))
[ -f dist/summary.json ] && hit=$((hit+1))
bash verify.sh >/dev/null 2>&1 && hit=$((hit+1))
echo "$hit $total"
