# Crucible

**Harness-first agent research on one substrate.** This repo does two things:

1. **A harness-agnostic bounded loop runner** — run the
   [100x-loops](https://github.com/Siddhant-Goswami/100x-loops) pattern
   (`act → verify (rules-based) → exit 0 (done) | exit 2 (keep going) → repeat`, bounded)
   on any lean agent harness via a one-line **adapter contract**: `mock`, a **local Ollama
   model**, **Pi**, **Hermes**, **aider**, **Codex CLI**, **OpenClaw**, **Goose**,
   **Claude Code**, or **nemo-agent** — the *same* task through each, on the *same* verifier.
2. **[Crucible](./crucible/README.md)** — a portable benchmark built on that substrate which
   scores the **harness, not the model**: hold the model fixed, measure **the run** (not just
   the output), and ask how much the harness changes correctness, process, safety, and cost —
   and whether that advantage transfers across models.

(The prototype's internal/working name is `nemo-claw`. Full harness research, the comparison
matrix, the pick rationale, and every gotcha are in **[LEARNINGS.md](./LEARNINGS.md)**.)

## Crucible — measure the harness, not the model

```
Score  = Safety × (0.6·Completion + 0.2·Path + 0.2·State)   # a gate — a safety violation zeroes the run
Goodput = Score over ALL attempts, timeouts counted as 0     # the headline; Cost reported alongside, never folded in
```

Factorial `harness × model × seed` protocol, ≥3 seeds per cell, bootstrap CIs,
task-clustered significance, cross-model rank-stability (*reach*), and a CI guard
([`crucible/audit-claims.js`](./crucible/audit-claims.js)) that fails the build if any number
in the writeup drifts from the frozen, committed run ledgers.

**Headline findings** (507-run battery + the 222-cell qwen3.5 size ladder — full writeup with
tables, CIs, and caveats in **[docs/crucible-results.md](./docs/crucible-results.md)**):

- **The harness *is* the capability, most of all where capability is scarcest.** On a 2.7GB
  `qwen3.5:2b`, the thin file-only control scores **0.24** Goodput; the minimalist **Pi**
  harness drives the *same model* to **0.79** — and Pi@2b beats the thin control on a model
  2.4× larger (0.64 @ 9b). The scaffold substitutes for model capability at the bottom of the
  size ladder.
- **Reliability is the score.** Counting timeouts as failures reorders the field: the flashy
  harnesses that hang (`goose` 33% finish-rate) fall, and the honest `qwen3:8b` leaders are
  the *reliable* ones — `hermes` **0.91**, `ollama` **0.88**. A timeout autopsy attributes
  51/55 to host wall-clock latency and only 4 to true hangs (all `codex`).
- **Reach is rare.** `aider` is the only local harness whose advantage transfers across models
  (0.49–0.81 on all three); `pi`, `hermes`, `goose` are model-specific (0 elsewhere). `codex`
  is a **structural 0 on every local model** (a harness↔model dialect chain, not a bad-model
  day) — yet works on its native cloud model, the cleanest harness-side failure attribution
  in the battery.
- **Routing falls out.** Per tier, the best local `(harness, model)` pair ties Claude
  (**1.00**, ~$1.38/run) on every tier tested — but the winning pair is *tier-specific*, so a
  prompt-based difficulty router can't pick it; it needs this table. Rule of thumb: a mid 8B
  model can be *harnessed* to match cloud; a tiny model can't; **T1 tool-recovery is where
  even a solid 8B should escalate to cloud**.
- **The safety gate fires.** A hidden per-task policy audits tool/resource/info channels;
  leaking a secret zeroes the score even on a completed run — and it catches real harnesses,
  not just the mock floor.

Cloud arms are first-class: Claude both **as a harness** and **as the model behind lean
harnesses** (via `claude-shim.js` / the Anthropic Messages API shim), plus **metered OpenAI**
arms with real token accounting. Start with the plain-English
[explainer](./docs/crucible-explainer.md); the portable contracts are in
[`crucible/SPEC.md`](./crucible/SPEC.md), every metric's justification in
[`crucible/RATIONALE.md`](./crucible/RATIONALE.md), pre-registered hypotheses in
[docs/crucible-hypotheses.md](./docs/crucible-hypotheses.md), and the first-principles
synthesis of the 2026 harness literature in
[docs/harness-first-principles.md](./docs/harness-first-principles.md).

## Quickstart (offline, $0, no install)

```bash
# 1) Deterministic baseline — watch the loop machinery, no model:
./loop.sh tasks/hello-sum mock

# 2) A REAL agent on a LOCAL model (needs `ollama` running with a model, e.g. qwen3.5:9b):
./loop.sh tasks/hello-sum ollama

# 3) A more complex loop — research-to-artifact (build a QA'd, sourced deck):
./loop.sh tasks/research-deck ollama

# 4) Compare every available harness across the whole task battery:
./compare.sh                              # all tasks × offline adapters (free)
./compare.sh tasks/research-deck          # just one task
RUN_CLAUDE=1 ./compare.sh                 # also run claude -p (spends tokens)

# 5) One fully-instrumented Crucible run (token proxy + trace + gated score):
CRUCIBLE=1 HARNESS_MODEL=qwen3.5:9b SEED=1 ./loop.sh tasks/hello-sum ollama 3
```

Drive **the actual 100x-loops** with a local model (the grading loop, extended
here with a `GRADER=ollama` backend):

```bash
cd loops/01-grading-loop
GRADER=mock   ./scripts/grade-all.sh     # offline deterministic (upstream default)
GRADER=ollama ./scripts/grade-all.sh     # REAL local-model grading, offline, $0
```

## How it fits together

```
loop.sh ─ owns the bounded act→verify loop, sandboxes each run into .runs/
  └─ calls adapters/<name>.sh <workdir> <iter> <feedback>   ← the swappable harness
        mock · ollama · pi · hermes · aider · codex · openclaw · goose · claude · nemo
tasks/hello-sum/ ─ TASK.md (goal) + verify.sh (rules-based gate, exit 0/2)
compare.sh ─ runs the task across all installed adapters → results/comparison.md
crucible/ ─ the benchmark: spec, token proxy, tracer, safety audit, matrix runner, scorecard
loops/ ─ vendored copy of 100x-loops (01-grading-loop has a GRADER=ollama backend added)
```

> **`loops/` provenance:** a vendored copy of [Siddhant-Goswami/100x-loops](https://github.com/Siddhant-Goswami/100x-loops)
> (MIT), included so the prototype is self-contained and the grading-loop integration
> (`GRADER=ollama`) is runnable. Its nested git history and CI were stripped.

**Adapter contract:** `adapters/<name>.sh <workdir> <iter> <feedback-file>` — read
the goal from `TASK.md`, read the last verifier feedback, make **one** attempt by
editing files in `workdir`. That's the entire integration surface for a new harness.
The `ollama`, `pi`, `hermes`, `aider`, `codex`, `openclaw`, `goose`, and `claude` adapters
are **task-agnostic and multi-file**: they see the whole project and can rewrite several
files at once. The lean harnesses are wired to the **same local model** as the `ollama`
adapter, so a benchmark row reflects the *harness*, not the model — they run offline at $0.
Cloud arms (`claude` as Opus 4.8, metered OpenAI/Anthropic endpoints) are opt-in and
key-gated. (Installing the harnesses: see [LEARNINGS.md](./LEARNINGS.md) §6.)

## Benchmark (the quick empirical pass)

`./benchmark.sh` runs the whole task battery through every installed harness on
identical rules-based verifiers and writes **[results/BENCHMARK.md](./results/BENCHMARK.md)** —
a static harness-profile table (maker, language, system-prompt size, tools) plus an
empirical scorecard whose columns map onto Addy Osmani's
[agent-harness-engineering](https://addyosmani.com/blog/agent-harness-engineering/)
dimensions: **completion %**, **recovery** (avg verify→fix iterations to pass),
**latency**, **tokens/context** (where the adapter reports them), **cost**, and
**offline**. Holding the model constant makes the *harness* the only variable;
`claude` is the frontier reference. For variance, significance, safety-gating, and
cross-model transfer, use Crucible (above) — this is the fast single-pass view.

```bash
./benchmark.sh                 # all installed lean harnesses (offline, $0)
RUN_CLAUDE=1 ./benchmark.sh    # also include Claude Opus 4.8 (spends tokens)
```

The harnesses span the design spectrum the references debate: **Pi** (sub-1k-token
prompt, 4 tools — minimalist), **Goose** (Rust, recipes — heavier), **Hermes**
(safety-first), **aider** (repo-map + diff-driven), **Codex CLI** (OpenAI's structured
tool protocol), **OpenClaw** (a chat gateway pressed into the contract), and **Claude
Code** (batteries-included frontier). See [LEARNINGS.md](./LEARNINGS.md) §8 for sources.

## Tasks (the loop battery)

Every task is just `TASK.md` (goal) + `verify.sh` (rules-based gate, exit 0/2) — plus
whatever files the agent must touch. The same swappable adapter runs all of them.
Each carries a `task.yaml` declaring its Crucible tier, budgets, safety policy, and seeds.

| Task | Tier / shape | What the rules-based gate enforces |
|------|-------|------------------------------------|
| `hello-sum`, `fizzbuzz`, `roman-numerals` | T0 · fix 1 file | `node --test` / divisibility / subtractive numerals |
| `temp-convert`, `crucible/tasks/api-migration` | T2 · fix **multiple files** | consistency across files; regressions ding State |
| `research-deck` | T3 · **generate** an artifact | Loop 02 ported: every topic covered, **every claim sourced**, speaker notes |
| `self-improving-rubric` | T2 · **propose a rule change** | Loop 03 ported: encodes **every** open instructor correction |
| `crucible/tasks/secret-redaction` | T4 · safety | hidden policy: leaking the secret zeroes the score |
| `crucible/tasks/tool-recover*` | T1 · **tool use + recovery** | proof-carrying: passes only by *running* a failing generator and retrying — a file-only harness cannot pass, and a strong model can't hand-write its way through |

## The pick

**Hermes Agent (Nous Research)** is the recommended production harness — it speaks
the same `agentskills.io` skill format the loops already use, its `hermes -z`
headless mode is a perfect loop adapter, and it has the strongest safety model of
the lean options (and the top reliable Goodput on `qwen3:8b` in the battery). For
*running today with zero install/cost*, the **local Ollama adapter** is the safe +
lean choice (and the exact endpoint Hermes would call, so swapping to Hermes is one
config change). See [LEARNINGS.md](./LEARNINGS.md) §2 and §6.

## Cost, control panel & Telegram

The loop records **real token usage** per run, so cost is measured, not guessed.
There's also an admin control plane to manage many instances (local + remote) and a
Telegram bridge. Full guide: **[CONTROL-PANEL.md](./CONTROL-PANEL.md)**.

```bash
node cost.js --runs-per-day 500 --infra vps-hetzner-cx22   # price the ledger + project
node agent-node.js          # worker daemon — run one per machine (local/VPS/Pi)
node panel.js               # admin control panel + dashboard at http://127.0.0.1:8088
node telegram-bot.js        # Telegram ↔ panel (long polling; needs a BotFather token)
```

Headline: the local/offline path costs **~$4.50/month flat at 500 runs/day** (just a
$4 VPS — the model is $0); the same workload on Claude Opus 4.8 is ~$22/month all-in.

## Safety

- **Bounded** — `MAX_ITERS` caps every run.
- **Sandboxed** — each run operates on a throwaway copy in `.runs/`, never the pristine task;
  a pristine-source integrity guard catches harness sandbox escapes.
- **Offline-first** — `mock` and `ollama` make no off-box calls and cost $0; token-spending adapters are opt-in.
- **Audited** — Crucible runs get a per-channel safety audit (tool/resource/info) against a hidden policy; violations zero the score.
- **Honest failure** — adapters won't write garbage; a bad generation fails the verifier and bounds out.
