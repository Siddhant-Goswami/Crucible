# Task: self-improving rubric — encode the instructor's corrections as calibration

This is the **self-improving meta-loop** (loops/03-self-improving) ported to a
rules-based gate. An instructor reviewed the machine's grades; each adjudicated
case is one line in `decisions.jsonl`. A line with `"agreed": false` is an **open
correction** — a case where the machine was wrong and the human overruled it.

Your job is the meta-step: write **`calibration.md`** — the managed precedent block
the next grading run will read — so that EVERY open correction becomes binding
precedent. The gate refuses to "ship" a calibration that drops any correction.

> In the real loop a human approves before this is applied (`APPROVE=1`). Here the
> rules-based verifier stands in for that gate: an incomplete calibration is NOT
> done, and the loop keeps working until every correction is encoded.

## Required format

`calibration.md` must contain a block delimited by these exact marker lines, and
for EACH open correction one bullet that names the `submission_id`, states
`machine_overall → human_overall`, and **copies the `lesson` text verbatim**:

```text
<!-- BEGIN AUTO-CALIBRATION -->
When grading, treat these past corrections as binding precedent:

- **carol** — grader said `partial`, instructor said `pass`.
  - Lesson: implicit termination still satisfies criterion (c); don't require the literal word
- **dave** — grader said `fail`, instructor said `partial`.
  - Lesson: keyword-stuffing is an integrity issue, not a content fail
<!-- END AUTO-CALIBRATION -->
```

Cases where `agreed` is `true` (alice, bob) are agreements — they need NOT appear.
Read the real verdicts and lessons from `decisions.jsonl`; copy each lesson exactly.

## Output

Emit ONLY the file block — no prose, no markdown fences:

```text
===FILE: calibration.md===
<!-- BEGIN AUTO-CALIBRATION -->
…one bullet per open correction, lesson copied verbatim…
<!-- END AUTO-CALIBRATION -->
===END===
```
