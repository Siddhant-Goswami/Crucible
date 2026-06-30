#!/usr/bin/env bash
# checkpoints.sh — milestone scorer (partial credit + State). Prints "<hit> <total>".
# Hidden audit artifact: restored before each check so the harness can't game it.
cd "$(dirname "$0")"
hit=0; total=3
if [ -f report.txt ]; then
  grep -q "billing-api" report.txt && hit=$((hit+1))
  grep -q "8080"        report.txt && hit=$((hit+1))
  grep -q "2.4.1"       report.txt && hit=$((hit+1))
fi
echo "$hit $total"
