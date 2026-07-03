# Datasheet for Crucible

> A [Gebru et al.](https://arxiv.org/abs/1803.09010)-style datasheet, adapted for a *benchmark +
> its result battery*. It documents what Crucible is, how the numbers were produced, what they may
> and may not be used for, and where they are weak — so a reader can judge the evidence without
> re-reading the code. Pairs with [`SPEC.md`](../crucible/SPEC.md) (contracts),
> [`crucible-results.md`](./crucible-results.md) (findings), and
> [`crucible-related-work.md`](./crucible-related-work.md) (positioning).

## Motivation

- **Why was it created?** To measure the **agent harness** (the scaffolding around an LLM — prompt
  assembly, tools, loop, memory, verification, recovery, permissions) rather than the model, and to
  turn that measurement into a **local-vs-cloud routing decision** (which harness+model for which
  kind of task). Existing benchmarks conflate model and harness; the routing literature routes on
  prompt difficulty, not task/tool requirements.
- **Who created it?** This repository (`nemo-claw`), building on the P1–P9 first-principles synthesis
  in [`harness-first-principles.md`](./harness-first-principles.md).

## Composition

- **Unit of measurement:** the **run** — one `(harness × model × task × seed)` execution under a
  fixed token/iteration budget, producing a per-iteration `trace.jsonl` and a scored run record.
  A run is *not* a single final-answer datapoint (P1).
- **Harnesses (8):** `mock` (deterministic floor), `ollama` (thinnest control), `pi`, `hermes`,
  `goose`, `codex`, `aider`, `claude`. Static properties in `harness-profiles.json`.
- **Models (7 observed in the battery):** local — `deepseek-r1:1.5b`, `qwen3:8b`, `deepseek-r1:8b`
  (Ollama, quantized, digests in `ENV.md`); cloud — `claude-opus-4-8` (Anthropic), `gpt-5.5`
  (OpenAI, via a ChatGPT-account codex login), `gpt-4o-mini` (OpenAI, metered API); plus `baseline`
  for the model-free `mock`.
- **Tasks (11), tiered by what stresses the harness:** T0 floor (`hello-sum`, `fizzbuzz`,
  `roman-numerals`); T1 tool-recovery ×3 (`tool-recover` — two-phase generator, hardened with a
  nonce+sha256 **proof-of-execution** so the fixture cannot be hand-written; `tool-recover-lock`
  — stale-lock deletion recovery; `tool-recover-config` — config-from-error recovery; all three
  proof-carrying and self-tested in CI); T2 long-horizon/stateful (`temp-convert`,
  `api-migration`, `self-improving-rubric`); T3 evidence/artifact (`research-deck`); T4
  safety/governance (`secret-redaction`). Each is a directory with a shown `TASK.md`, a hidden
  deterministic `verify.sh`, `task.yaml` (budgets/tier/policy/seeds), and optional
  `checkpoints.sh`/`policy.json`. (The pilot battery below ran the original 9; the T1 additions
  enter with the scaled battery so tier-level claims rest on ≥3 tasks.)
- **How many instances?** The published battery is **515 runs**: a 507-run local factorial (8
  harnesses × 3 local models × 9 tasks × 3 seeds, minus a Claude frontier slice included) + an
  8-run OpenAI cloud slice (§6.5). Frozen in
  [`crucible/results/battery.published.jsonl`](../crucible/results/battery.published.jsonl).
- **Labels / targets:** each run carries deterministic sub-scores (Completion/Path/State), a Safety
  SAR triple, a gated Score, a `failure_mode` (execution-alignment taxonomy), a `timed_out` flag, and
  token/latency metering. No human labels.
- **Is anything missing?** `codex`/`openclaw` bypass the token proxy (tokens read 0/`—`); `gpt-5.5`
  ran on a subscription (unmetered, `$0*`). 55 local cells timed out (recorded as score-0 delivery
  failures, counted in Goodput/Reliability, absent from finished-run detail).

## Collection process

- **How were runs generated?** `crucible/matrix.sh` drives the bounded act→verify loop (`loop.sh`)
  per cell; an ephemeral per-run token-logging proxy (`crucible/proxy/ollama-proxy.js`) meters
  HTTP-layer usage; `crucible/finalize.js` computes the gated profile from the trace + oracle.
- **Software/hardware:** node 22; Ollama 0.30.11 on Darwin arm64 (Apple Silicon) for local models —
  so **latency is hardware-conditional**; cloud via provider APIs / CLIs. Exact digests + host in
  [`ENV.md`](../crucible/results/ENV.md).
- **Sampling:** ≥3 seeds per local cell (fewer on the cloud slice — 1 seed — which is exploratory).
  Temperature 0.7 so seeds give real variance (P9).
- **Integrity (P5):** oracles/policies/checkpoints are hidden from the harness and restored from
  pristine before every check, so no run can pass by editing the gate.

## Preprocessing / scoring

`Score = Safety × (0.6·Completion + 0.2·Path + 0.2·State)`, a multiplicative safety gate; **Cost is
reported alongside, never folded in** (P6/P7). Headline is **Goodput** (Score over *all* attempts,
timeouts = 0) with **Reliability** (finish-rate) and **pass^k** beside it; conditional `Score|fin`
kept for reference. All bootstrap CIs use a **seeded** RNG so `SCORECARD.md` is byte-reproducible.
The report is regenerated by `crucible/report.js`; a docs↔data guard (`crucible/audit-claims.js`,
14 pinned claims) fails CI if any writeup number drifts from the ledger.

## Recommended uses

- **Comparing harnesses on a fixed model**, and **testing whether a harness advantage transfers**
  across models (the reach/rank-stability check).
- **Local-vs-cloud routing decisions** keyed on task tier (§4 routing table): e.g. "qwen3:8b clears
  every tier locally; an 8B model should escalate T1 tool-recovery to cloud."
- **Harness diagnostics** via the failure-mode taxonomy + traces.

## Uses to AVOID (out of scope / would misuse the data)

- **Ranking models.** Crucible fixes the model to measure the harness; it is not a model leaderboard.
- **Reading a harness's number without its `(harness, model)` pair, model, or the Rel%/Cost columns.**
- **Treating local latency as portable** — it is this host's, not a datacenter's.
- **Treating the cloud slice (1 seed, 4 tasks) as equal-power** to the local factorial — it is
  exploratory; its CIs are wide and it is labelled as such.
- **Treating `$0`/`—` cost cells as "free"** — they are metering blind spots or subscription runs.

## Distribution & maintenance

- The **spec, code, tasks, and the frozen published ledger** are in-repo; the writeup regenerates
  from the frozen ledger. Re-running `crucible/bench.sh` reproduces the local battery (hardware- and
  quantization-conditional); the OpenAI/Anthropic slices need the respective keys (see
  `crucible-results.md` §7).
- **Maintenance:** the claims guard + deterministic scorecard + CI (`.github/workflows/crucible.yml`)
  keep docs and data in lock-step; new harnesses/tasks plug in via the `SPEC.md` contracts.

## Known limitations (see also `crucible-related-work.md` §4)

1. **Homegrown 9-task battery** — not yet anchored to a recognized suite (SWE-bench-Verified /
   Terminal-Bench / τ²-bench). `crucible/tools/import-task.js` wraps any external "files + test
   command" instance into a Crucible task (self-tested in CI), so the *contract* generalizes; what
   remains is provisioning real suites' per-instance environments and running the anchored slice.
   **Until that slice is run, external validity is limited.**
2. **Construct validity of Path/State** — deterministic proxies for fuzzy process quality, *not yet
   validated against human judgment*. Flagged, never silently judged by an LLM.
3. **Narrow model panel for reach** — 3 local models in 2 families + 3 cloud models (1 seed). The
   transfer claim needs ≥3 local families and multi-seed cloud to be robust.
4. **Metering blind spots & subscription runs** — `codex`/`openclaw` unmetered; `gpt-5.5` on a
   subscription; Claude cost is a cache-inflated upper bound + ~22k/call system-prompt tax.
5. **Few seeds** → wide CIs; most pairwise differences are correctly *not significant*. pass^k and
   power analysis are reported/roadmapped, not assumed away.
