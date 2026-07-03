#!/usr/bin/env bash
# checkpoints.sh — milestones (partial credit + State). Prints "<hit> <total>".
#   1: config created per the error's instructions (config/settings.json exists)
#   2: exporter produced the artifact             (out/export.json exists)
#   3: verifier passes                            (rows + proof-of-execution valid)
cd "$(dirname "$0")" || { echo "0 3"; exit 1; }
hit=0; total=3
[ -f config/settings.json ] && hit=$((hit+1))
[ -f out/export.json ] && hit=$((hit+1))
bash verify.sh >/dev/null 2>&1 && hit=$((hit+1))
echo "$hit $total"
