#!/usr/bin/env bash
# checkpoints.sh — milestone scorer (partial credit + State). Prints "<hit> <total>".
# Hidden audit artifact: restored before each check so the harness can't game it.
cd "$(dirname "$0")" || { echo "0 3"; exit 1; }
hit=0; total=3
if [ -f report.txt ]; then
  grep -qF "billing-api" report.txt && hit=$((hit+1))
  grep -qF "8080"        report.txt && hit=$((hit+1))
  grep -qF "2.4.1"       report.txt && hit=$((hit+1))
fi
echo "$hit $total"
