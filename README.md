# hermes-control-panel

**Run the [100x-loops](https://github.com/Siddhant-Goswami/100x-loops) loop pattern
on any lean agent harness (Hermes / local Ollama / Claude / nemo-agent), compare
them on one verifier, price them from real token usage, and manage the fleet from a
web dashboard + Telegram.** (The prototype's internal/working name is `nemo-claw`.)

The 100x-loops thesis is *who owns the loop*: an agent is
`act → verify (rules-based) → exit 0 (done) | exit 2 (keep going) → repeat`, bounded.
This repo makes that loop **harness-agnostic** by generalizing the loops' own
`GRADER=mock|claude` seam into a one-line **adapter contract**, so you can drop in
`mock`, a **local Ollama model**, **Hermes**, **Claude Code**, or **nemo-agent** as
the "brain" — and run the *same* task through each on the *same* verifier.

> Full research, the harness comparison matrix, the pick rationale, and every
> gotcha are in **[LEARNINGS.md](./LEARNINGS.md)**.

> **Rigorously evaluating harnesses → [`crucible/`](./crucible/README.md).** Crucible is a
> portable benchmark that scores the *harness* (not the model) on **the run, not the output** —
> a gated profile `Safety × (Completion + Path + State)`, Cost reported alongside, run as a
> factorial `harness × model × seed` with variance, significance, and cross-model transfer. It
> operationalizes the first-principles synthesis in
> [`docs/harness-first-principles.md`](./docs/harness-first-principles.md).

## Quickstart (offline, $0, no install)

```bash
# 1) Deterministic baseline — watch the loop machinery, no model:
./loop.sh tasks/hello-sum mock

# 2) A REAL agent on a LOCAL model (needs `ollama` running with a model, e.g. qwen3:8b):
./loop.sh tasks/hello-sum ollama

# 3) A more complex loop — research-to-artifact (build a QA'd, sourced deck):
./loop.sh tasks/research-deck ollama

# 4) Compare every available harness across the whole task battery:
./compare.sh                              # all tasks × offline adapters (free)
./compare.sh tasks/research-deck          # just one task
RUN_CLAUDE=1 ./compare.sh                 # also run claude -p (spends tokens)
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
        mock · ollama · pi · hermes · openclaw · goose · claude · nemo
tasks/hello-sum/ ─ TASK.md (goal) + verify.sh (rules-based gate, exit 0/2)
compare.sh ─ runs the task across all installed adapters → results/comparison.md
loops/ ─ vendored copy of 100x-loops (01-grading-loop has a GRADER=ollama backend added)
```

> **`loops/` provenance:** a vendored copy of [Siddhant-Goswami/100x-loops](https://github.com/Siddhant-Goswami/100x-loops)
> (MIT), included so the prototype is self-contained and the grading-loop integration
> (`GRADER=ollama`) is runnable. Its nested git history and CI were stripped.

**Adapter contract:** `adapters/<name>.sh <workdir> <iter> <feedback-file>` — read
the goal from `TASK.md`, read the last verifier feedback, make **one** attempt by
editing files in `workdir`. That's the entire integration surface for a new harness.
The `ollama`, `pi`, `hermes`, `openclaw`, `goose`, and `claude` adapters are
**task-agnostic and multi-file**: they see the whole project and can rewrite several
files at once. **Pi, Hermes, OpenClaw, and Goose are all wired to the same local
`qwen3:8b`** as the `ollama` adapter, so a benchmark row reflects the *harness*, not
the model — they run offline at $0; only `claude` (Opus 4.8) is cloud. (Installing
them: see [LEARNINGS.md](./LEARNINGS.md) §6.)

## Benchmark

`./benchmark.sh` runs the whole task battery through every installed harness on
identical rules-based verifiers and writes **[results/BENCHMARK.md](./results/BENCHMARK.md)** —
a static harness-profile table (maker, language, system-prompt size, tools) plus an
empirical scorecard whose columns map onto Addy Osmani's
[agent-harness-engineering](https://addyosmani.com/blog/agent-harness-engineering/)
dimensions: **completion %**, **recovery** (avg verify→fix iterations to pass),
**latency**, **tokens/context** (where the adapter reports them), **cost**, and
**offline**. Holding the model constant (local `qwen3:8b`) makes the *harness* the
only variable; `claude` is the frontier reference.

```bash
./benchmark.sh                 # all installed lean harnesses (offline, $0)
RUN_CLAUDE=1 ./benchmark.sh    # also include Claude Opus 4.8 (spends tokens)
```

The harnesses span the design spectrum the references debate: **Pi** (sub-1k-token
prompt, 4 tools — minimalist), **Goose** (Rust, recipes — heavier), **Hermes**
(safety-first), **OpenClaw** (a chat gateway pressed into the contract), and **Claude
Code** (batteries-included frontier). See [LEARNINGS.md](./LEARNINGS.md) §8 for sources.

## Tasks (the loop battery)

Every task is just `TASK.md` (goal) + `verify.sh` (rules-based gate, exit 0/2) — plus
whatever files the agent must touch. The same swappable adapter runs all of them.

| Task | Shape | What the rules-based gate enforces |
|------|-------|------------------------------------|
| `hello-sum` | fix 1 file | `node --test` passes |
| `fizzbuzz` | fix 1 file | FizzBuzz divisibility rules |
| `roman-numerals` | fix 1 file | subtractive numerals (`IV`, `IX`, `CM`…) |
| `temp-convert` | fix **2 files** | both converters + the `-40` fixed point |
| `research-deck` | **generate** an artifact | Loop 02 ported: a deck covering every topic, **every claim sourced**, every slide has speaker notes (≥5 slides, title+summary) |
| `self-improving-rubric` | **propose a rule change** | Loop 03 ported: a calibration block that encodes **every** open instructor correction (id + verbatim lesson) — an incomplete proposal is *not* done |

The last two are the [100x-loops](https://github.com/Siddhant-Goswami/100x-loops)
`02-research-to-artifact` (orchestrator-worker + evaluator-optimizer) and
`03-self-improving` (the meta-loop that edits its own rules) ported to the
harness-agnostic runner — same rules-based gates, now driven by any adapter.

## The pick

**Hermes Agent (Nous Research)** is the recommended production harness — it speaks
the same `agentskills.io` skill format the loops already use, its `hermes -z`
headless mode is a perfect loop adapter, and it has the strongest safety model of
the lean options. For *running today with zero install/cost*, the **local Ollama
adapter** is the safe + lean choice (and the exact endpoint Hermes would call, so
swapping to Hermes is one config change). See [LEARNINGS.md](./LEARNINGS.md) §2 and §6.

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
- **Sandboxed** — each run operates on a throwaway copy in `.runs/`, never the pristine task.
- **Offline-first** — `mock` and `ollama` make no off-box calls and cost $0; token-spending adapters are opt-in.
- **Honest failure** — adapters won't write garbage; a bad generation fails the verifier and bounds out.
