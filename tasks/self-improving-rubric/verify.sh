#!/usr/bin/env bash
# verify.sh — rules-based gate for the self-improving-rubric task. The proposed
# calibration is DONE only when it encodes EVERY open instructor correction
# (id + verbatim lesson). Mirrors the safety stance of loops/03-self-improving:
# a self-modifying step never "ships" until its proposal is complete + well-formed.
#   complete -> exit 0 -> DONE.   incomplete -> exit 2 -> reasons fed back, KEEP GOING.
# Deterministic, ~free — pure jq + grep, no LLM judge.
set -uo pipefail
cd "$(dirname "$0")"
CAL="calibration.md"
DEC="decisions.jsonl"

if [ ! -f "$CAL" ]; then
  echo "No calibration.md yet. Encode every open correction, then stop."
  exit 2
fi

if ! grep -q 'BEGIN AUTO-CALIBRATION' "$CAL" || ! grep -q 'END AUTO-CALIBRATION' "$CAL"; then
  echo "calibration.md must contain the BEGIN/END AUTO-CALIBRATION marker lines."
  exit 2
fi

# the managed block only — precedent must live between the markers
block="$(awk '/BEGIN AUTO-CALIBRATION/{f=1;next} /END AUTO-CALIBRATION/{f=0} f' "$CAL")"

problems=()
# every open correction (agreed=false) must be represented: id AND its lesson
while IFS=$'\t' read -r id lesson; do
  [ -z "$id" ] && continue
  if ! printf '%s' "$block" | grep -qF "$id"; then
    problems+=("open correction '$id' is not mentioned in the calibration block")
    continue
  fi
  if [ -n "$lesson" ] && ! printf '%s' "$block" | grep -qF "$lesson"; then
    problems+=("correction '$id' is present but its lesson is missing/altered (copy it verbatim)")
  fi
done < <(jq -r 'select(.agreed|not) | [.submission_id, .lesson] | @tsv' "$DEC")

if [ ${#problems[@]} -eq 0 ]; then
  exit 0
else
  echo "Calibration is incomplete. Fix these before stopping:"
  printf '  - %s\n' "${problems[@]}"
  exit 2
fi
