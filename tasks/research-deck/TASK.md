# Task: turn a topic list into a QA'd, fully-sourced lecture deck

This is the **research-to-artifact loop** (orchestrator-worker + evaluator-optimizer),
ported to the harness-agnostic runner. The lecture topics are in `topics.md`
(one per line: `<slug> — <title>`). Produce a single file **`deck.json`** — the
structured deck — that PASSES the rules-based QA gate (`verify.sh`).

## Hard rules the gate enforces (a deck that breaks ANY of these is NOT done)

- Top level: `title` (string, ≥5 chars) and `generated_for` (audience string).
- `slides`: an array of **5–30** slides. Must include at least one slide with
  `"type":"title"` and one with `"type":"summary"`.
- **Coverage:** one `"type":"content"` slide per topic, with that topic's slug in
  its `topic` field. EVERY topic in `topics.md` must be covered.
- **Sourcing:** EVERY content slide has a non-empty `claims` array, and EVERY
  claim is `{ "text": "...", "source": "https://..." }` — every claim cites a
  source URL. An unsourced claim cannot reach a slide.
- **Notes:** EVERY slide (title, content, summary) has `speaker_notes` ≥30 chars.

## Slide shape

```json
{ "id": "s1", "type": "title|content|summary", "heading": "…",
  "topic": "<slug or null>", "bullets": ["…"],
  "claims": [{ "text": "…", "source": "https://…" }],
  "speaker_notes": "…" }
```

Title/summary slides use `"topic": null` and need no claims (but still need notes).

## Output

Emit ONLY the file block — no prose, no markdown fences:

```text
===FILE: deck.json===
{ …the deck… }
===END===
```

> This runs offline with a local model. The gate checks that every claim carries a
> well-formed `http(s)` source and that structure + coverage hold — it does **not**
> fetch the URLs. Cite the most accurate sources you know for each claim.
