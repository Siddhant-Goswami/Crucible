#!/usr/bin/env bash
# checkpoints.sh — milestones (partial credit + State). Prints "<hit> <total>".
#   1: generator run once   (.gen-stamp exists)
#   2: generator run again  (fixtures/cases.json exists)
#   3: tests pass           (factorial fixed + fixture present)
cd "$(dirname "$0")" || { echo "0 3"; exit 1; }
hit=0; total=3
[ -f .gen-stamp ] && hit=$((hit+1))
[ -f fixtures/cases.json ] && hit=$((hit+1))
node --test mathlib.test.js >/dev/null 2>&1 && hit=$((hit+1))
echo "$hit $total"
