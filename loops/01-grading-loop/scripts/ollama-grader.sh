#!/usr/bin/env bash
# ollama-grader.sh — a REAL grader backed by a LOCAL model (offline, zero cost).
#
# Drop-in replacement for mock-grader.sh / the `claude -p /grade` step. Same
# contract: take one submission, write a schema-shaped out/<id>.grade.json, echo
# the path. The grading loop's own verify-grade.sh then decides whether the grade
# is rubric/schema valid — if not, grade-all.sh's bounded inner loop retries (a
# fresh sample) or routes the submission to a human. This is the loop's
# self-correction working against a genuinely non-deterministic grader.
#
# Enabled via:  GRADER=ollama ./scripts/grade-all.sh
# Env: OLLAMA_MODEL (default qwen3:8b), OLLAMA_HOST (default http://localhost:11434)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

sub="${1:?usage: ollama-grader.sh <submission.md>}"
id="$(basename "$sub" .md)"
MODEL="${OLLAMA_MODEL:-qwen3:8b}"
HOST="${OLLAMA_HOST:-http://localhost:11434}"
mkdir -p out
target="out/${id}.grade.json"

RUBRIC="$(cat rubric.md)"
SUBMISSION="$(cat "$sub")"

PROMPT="You are grading one student submission. Return ONLY a JSON object.

RUBRIC:
$RUBRIC

SUBMISSION (id='$id'):
$SUBMISSION

Produce a JSON object with EXACTLY these fields:
- submission_id: the string \"$id\"
- criteria: object with keys correctness, completeness, clarity; each is an object
  {level: one of \"pass\"|\"partial\"|\"fail\", evidence: a >=10 char quote/pointer from the submission}
- overall: \"pass\"|\"partial\"|\"fail\", following the rubric's verdict mapping exactly
  (pass = correctness=pass AND completeness=pass AND clarity!=fail; fail = correctness=fail OR completeness=fail; else partial)
- confidence: number 0..1, honest; lower it when hedging
- needs_human_review: boolean per the rubric's escalation rule
- reasoning: a >=20 char justification tied to rubric evidence
Output only the JSON, no commentary."

# Ollama structured output: format:json forces a syntactically valid JSON object;
# think:false disables chain-of-thought (faster, no prose leakage).
RESP="$(curl -s "$HOST/api/generate" \
  -d "$(jq -n --arg m "$MODEL" --arg p "$PROMPT" '{model:$m, prompt:$p, stream:false, think:false, format:"json"}')")"

printf '%s' "$RESP" | jq -r '.response // empty' > "$target"
echo "$target"
