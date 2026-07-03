# Phase C — the qwen3.5 size ladder (capability-per-GB) · 2026-07-03

> The scaled battery: the qwen3.5 **size ladder** {2b, 4b, 9b}, think-OFF, run under the full
> Phase A hardening (per-model timeout fits, seeded cell-shuffle `ORDER_SEED=137`, per-cell health
> canary). Ledger `qwen35-scaled.jsonl` — **222 cells** = 3 models × 4 harnesses
> {pi, ollama, aider, codex} × 6 tasks {hello-sum · tool-recover · tool-recover-lock ·
> tool-recover-config · api-migration · secret-redaction} × 3 seeds, + mock floor. Claims pinned in
> `audit-claims.js`; scorecard `SCORECARD-qwen35-scaled.md`.

## The ladder — Goodput by harness × model (18 cells per pair)

| harness | 2b (2.7GB) | 4b (3.4GB) | 9b (6.6GB) | mean |
|---|--:|--:|--:|--:|
| **pi** | **0.79** | 0.60 | **0.92** | **0.77** |
| ollama (thin control) | 0.24 | 0.55 | 0.64 | 0.48 |
| aider | 0.30 | 0.32 | 0.41 | 0.34 |
| codex | 0.00 | 0.00 | 0.00 | 0.00 |

## Findings

1. **The harness *is* the capability, most of all where capability is scarcest.** On the 2.7GB `2b`
   model the thin `ollama` control scores **0.24**; `pi` scores **0.79** — Δ=**0.55 [0.18, 0.87]**,
   **significant** (task-clustered bootstrap). A 2.7GB model that fails 8/9 plain T0 tasks by itself
   (calibration: 1/9) is driven to 0.79 Goodput by the right harness. This is the harness-first
   thesis at its sharpest: the scaffold substitutes for model capability precisely at the bottom of
   the ladder.

2. **The thin control rides raw capability; a real harness partly decouples from it.** `ollama`
   climbs monotonically with size (0.24 → 0.55 → 0.64) — a bare parser has nothing but the model.
   `pi` leads at *every* size and its 2b (0.79) already exceeds `ollama`'s 9b (0.64): the harness
   buys more than a 2.4× model-size increase does.

3. **Reach across sizes is partial (rank-stability τ = 0.78).** The extremes are stable — `pi` tops
   and `codex` floors every size — but the *middle swaps*: `aider > ollama` on 2b, `ollama > aider`
   on 4b/9b. Harness advantage is not fully size-transferable even within one family and generation;
   the reach/transfer test (P4) fires on the middle of the field.

4. **`codex` is a structural 0 across the entire ladder** (dialect chain, §6.6) — capability-
   independent, as everywhere else locally.

5. **Capability-per-GB is NOT monotonic for the tool harness.** `pi`'s 4b mean (0.60) sits *below*
   its 2b (0.79): the `qwen3.5:4b` checkpoint has task-specific holes — pi scores 0.33 on hello-sum
   and 0.00 on tool-recover-lock at 4b, versus 1.00 / 0.48 at 2b. So "bigger is better" fails at the
   4b rung for this harness (partly 3-seed noise; flagged, not smoothed). The routing lesson: pick
   the pair per task, not the largest model.

## Methods win — the timeout autopsy confirms the Phase A hardening worked

All **22 timeouts classify as harness HANGS (12) or near-kill-ambiguous (10) — 0 HOST_DEGRADED,
0 host-conditional wall-clock cutoffs** (`classify-timeouts.js` + the canary sidecar). The very
first three-arm battery was **93% host-thrash**; this one, run with the per-model fits + seeded
shuffle + canary, is **0%**. The host stayed healthy throughout (canary tok/s never < 13; swap
1.6 → 3 GB, no collapse). So this battery's timeouts are genuinely harness-attributable (11 of 22
are `aider`), and Goodput here measures harness reliability, not the host — exactly what §5A.1 was
built to guarantee. **The pristine-source integrity guard also fired twice in production**
(`qwen35-scaled.integrity.jsonl`): two harness sandbox-escapes were caught and the task restored
from git before the next cell, so no cell ran against a corrupted source.

## Scope / caveats

3 seeds (wide CIs; the 4b non-monotonicity may partly be noise). Ladder is one family × one
generation (that is the point — a within-family capability-per-GB sweep on 16GB hardware).
`hermes`/`goose` excluded (config / Ollama-native protocol, per Phase B). No think-ON arm here —
the 9b toggle effect is already established by the three-arm study (`qwen35-pilot` vs
`qwen35-think-off`); Phase C's contribution is the size axis.
