#!/usr/bin/env bash
# verify.sh — rules-based QA gate for the research-to-artifact task.
# Ported from loops/02-research-to-artifact/scripts/qa-deck.sh (the Stop-hook
# evaluator) to the harness-agnostic contract:
#   deck passes QA -> exit 0 -> loop may stop. DONE.
#   deck fails QA  -> exit 2 -> reasons printed, fed back, loop KEEPS GOING.
# Deterministic, ~free — never "ask an LLM if the deck is good".
set -uo pipefail
cd "$(dirname "$0")"
DECK="deck.json"
TOPICS_FILE="topics.md"

topic_slugs() { grep -E '^[a-z0-9-]+ +— ' "$TOPICS_FILE" | sed -E 's/ +— .*//'; }

if [ ! -f "$DECK" ]; then
  echo "No deck at $DECK yet. Assemble it covering every topic, then stop."
  exit 2
fi
if ! jq empty "$DECK" 2>/dev/null; then
  echo "$DECK is not valid JSON."
  exit 2
fi

problems=()

# ---- structural checks (schema-equivalent, via jq) ---------------------------
while IFS= read -r line; do [ -n "$line" ] && problems+=("$line"); done < <(jq -r '
  [
    (if (.title|type)=="string" and (.title|length>=5) then empty else "title missing/too short" end),
    (if (.generated_for|type)=="string" then empty else "generated_for missing" end),
    (if (.slides|type)=="array" and (.slides|length>=5) then empty else "need >=5 slides" end),
    (if (.slides|length)<=30 then empty else "more than 30 slides" end),
    (if (any(.slides[]; .type=="title"))   then empty else "no title slide"   end),
    (if (any(.slides[]; .type=="summary")) then empty else "no summary slide" end),

    # EVERY slide must carry speaker notes (the headline rule).
    (.slides[] | select((.speaker_notes|type)!="string" or (.speaker_notes|length)<30)
       | "slide \(.id // "?"): missing/short speaker_notes"),

    # EVERY content slide needs >=1 claim, and every claim a real source URL.
    (.slides[] | select(.type=="content")
       | select((.claims|type)!="array" or (.claims|length)==0)
       | "content slide \(.id // "?"): no claims"),
    (.slides[] | select(.type=="content") | .claims[]?
       | select((.source|type)!="string" or (.source|test("^https?://")|not))
       | "content slide claim has no valid source URL: \(.text[0:40])")
  ] | .[]' "$DECK" 2>/dev/null)

# ---- coverage: every topic in topics.md has a content slide ------------------
covered="$(jq -r '[.slides[]|select(.type=="content")|.topic]|@tsv' "$DECK" 2>/dev/null || true)"
while IFS= read -r slug; do
  [ -z "$slug" ] && continue
  if ! printf '%s' "$covered" | tr '\t' '\n' | grep -qx "$slug"; then
    problems+=("topic not covered by any content slide: $slug")
  fi
done < <(topic_slugs)

if [ ${#problems[@]} -eq 0 ]; then
  exit 0
else
  echo "Deck failed QA. Fix these before stopping:"
  printf '  - %s\n' "${problems[@]}"
  exit 2
fi
