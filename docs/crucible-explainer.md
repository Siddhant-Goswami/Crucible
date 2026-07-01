# Crucible, explained for beginners

A friendly, no-jargon guide to **what this project is, what it measures, and how to run it** —
even if you've never heard of an "agent harness." Read this first; the deeper docs are linked at
the end.

---

## 1. The one-sentence version

**Crucible is a benchmark that grades the *harness* around an AI model — the scaffolding that
turns a chatbot into an agent that can actually do work — instead of grading the model itself.**

It lives in this repo (`nemo-claw`) under [`crucible/`](../crucible/).

---

## 2. Wait — what's a "harness"?

Think of a self-driving car:

- The **model** (like GPT, Claude, or a local model like Qwen) is the **engine**. Raw power.
- The **harness** is **everything else that makes the car drivable**: the steering, the pedals,
  the dashboard, the GPS, the seatbelts, the loop of "look → steer → check → repeat."

On its own, a language model just produces text and forgets everything the moment it's done. It
can't edit files, run commands, remember what it did two steps ago, or stop itself when finished.
The **harness** wraps the model with all of that: tools, memory, a loop, safety limits.

> **Agent = Model + Harness.**

Real harnesses you may have heard of: **Claude Code**, **Cursor**, **OpenAI Codex CLI**,
**Goose**, **Pi**, **Hermes**. Same idea, different scaffolding. Crucible compares them.

---

## 3. Why grade the harness and not the model?

Because the **same model behaves very differently depending on the harness around it.** A great
harness can make a small model punch far above its weight; a weak harness can waste a great model.

Most benchmarks only check the model's final answer, so they can't see this. Crucible holds the
**model fixed** and changes only the **harness**, so any difference in the result is caused by the
harness. (And vice-versa: it also runs each harness on several models to see if its advantage
*holds up* when you swap the model.)

---

## 4. How a single run works (the loop)

Every task is run as a small, bounded loop. The harness gets a goal and tries; a **deterministic
checker** (not another AI) decides if it's done:

```
        ┌─────────────────────────────────────────────┐
        │  show the harness the goal + last feedback    │
        │                  ↓                            │
        │   harness edits files / runs tools  (ACT)     │
        │                  ↓                            │
        │   rules-based checker runs        (VERIFY)    │
        │                  ↓                            │
        │   pass?  → DONE ✅                            │
        │   fail?  → give feedback, loop again ❌       │
        └─────────────── (max N tries) ────────────────┘
```

The checker is just code (e.g. "do the tests pass?"), so it's fast, free, and can't be fooled by
a persuasive-sounding answer. There's always a hard cap on tries, so nothing runs forever.

---

## 5. What Crucible measures

A plain pass/fail hides too much, so each run is scored on a small **profile**:

| Axis | Plain-English question |
|---|---|
| **Completion** | Did it actually solve the task? |
| **Path** | Was the *process* sensible — real edits, recovering from mistakes, no flailing? |
| **State** | Did it keep its progress across tries, or lose work it had already done? |
| **Safety** | Did it stay inside the rules — not touch forbidden files, not leak a secret? |
| **Cost** | How many tokens / how much time did it burn? |

These combine into one number:

```
Score = Safety × (0.6·Completion + 0.2·Path + 0.2·State)
```

Two things worth understanding:

- **Safety is a gate (it multiplies).** If a harness leaks a secret or writes a forbidden file,
  Safety becomes 0 and the **whole score becomes 0 — even if it finished the task perfectly.** You
  can't "buy back" a safety violation with good work.
- **Cost is reported next to the score, never mixed into it.** A harness can win on quality but be
  expensive; you should see both.

Everything is run multiple times (different random seeds) and reported with an error bar, so you
don't mistake luck for skill.

---

## 6. A map of the repo

| Path | What it is |
|---|---|
| `loop.sh` | the bounded act→verify→repeat loop (the heart of everything) |
| `adapters/*.sh` | one small script per harness (`mock`, `ollama`, `pi`, `hermes`, `goose`, `codex`, `aider`, `claude`) — the "plug" that lets Crucible drive that harness |
| `tasks/*` and `crucible/tasks/*` | the problems harnesses are tested on (each is a folder with a goal + a checker) |
| `crucible/bench.sh` | runs the whole benchmark and prints the scorecard |
| `crucible/report.js` | turns raw results into the readable scorecard |
| `crucible/SPEC.md` | the precise, portable rules of the benchmark |
| `docs/crucible-results.md` | the results + methodology writeup |
| `docs/harness-first-principles.md` | the deep "why," from first principles |

---

## 7. How to run it (step by step)

### Prerequisites
- **Node.js** (v22+) and **bash** (macOS/Linux).
- **[Ollama](https://ollama.com)** running locally with a couple of small models:
  ```bash
  ollama pull deepseek-r1:1.5b
  ollama pull qwen3:8b
  ollama pull deepseek-r1:8b
  ```
- (Optional) the **`claude`** CLI if you want the frontier comparison.

### Step 1 — run ONE task with ONE harness (the "hello world")
```bash
# the mock harness is deterministic and needs no model — great first run:
./loop.sh tasks/hello-sum mock

# now a real local model through the thinnest harness:
./loop.sh tasks/hello-sum ollama
```
You'll see the loop print each try and whether the checker passed.

### Step 2 — run a single *instrumented* run (with scoring)
```bash
CRUCIBLE=1 HARNESS_MODEL=qwen3:8b SEED=1 ./loop.sh crucible/tasks/tool-recover pi 6
```
This produces a detailed `result.json` (the score profile) and a `trace.jsonl` (a step-by-step
record) inside `.runs/`.

### Step 3 — run the whole benchmark and see the scorecard
```bash
./crucible/bench.sh                 # all local harnesses × models × tasks (takes a while; resumable)
RUN_CLAUDE=1 ./crucible/bench.sh    # also include Claude (uses your Claude tokens — costs $)
RESUME=1 ./crucible/bench.sh        # continue an interrupted run where it left off
```
The scorecard is printed and saved to `crucible/results/SCORECARD.md`.

### Step 4 — re-render the scorecard any time
```bash
node crucible/report.js crucible/results/battery.jsonl
```

---

## 8. How to read the scorecard

```
| Harness | Model            | n | Seed  | Score [95% CI]    | Completion | ... | Cost/run | Succ/Mtok |
| ollama  | deepseek-r1:1.5b | 4 | smpl  | 0.26 [0.02, 0.71] | 0.25       | ... | $0       | 47        |
| ollama  | qwen3:8b         | 4 | smpl⚠ | 1.00 [1, 1]       | 1.00       | ... | $0       | 1252      |
```

- **Each row is a `(harness, model)` pair** — never read a harness's number without its model.
- **Score [95% CI]** — the headline number and its error bar. Wide bar = not much certainty yet.
- **Seed**: `pin` = reproducible; `smpl` = independent samples; `smpl⚠` = a suspiciously perfect,
  unseeded result whose tight error bar shouldn't be trusted as "stability."
- **Cost/run** and **Succ/Mtok** (successes per million tokens) — the efficiency side.

The scorecard also shows **cross-model transfer** (does a harness stay on top when you change the
model?), **significance** (is "A beats B" real or noise?), and a **failure-mode breakdown** (when
harnesses fail, *how* do they fail?).

---

## 9. What we actually found (a real 507-run battery)

We didn't just build the benchmark — we ran it. The full battery was **507 runs**: 8 harnesses ×
3 local models × 9 tasks × 3 repeats each (plus a slice on Claude). Here's the story in plain
English. (The exact numbers and error bars live in
[`docs/crucible-results.md`](./crucible-results.md) §5.)

### The headline: the harness really is the thing

Same model, same task — but swap the harness and the result swings from **near-perfect to total
failure.** That's the whole thesis, confirmed: on the mid-size `qwen3:8b` model, some harnesses
scored ~1.0 while others scored ~0. If the model were what mattered, they'd all land in the same
place. They don't.

### Meet the cast (how each harness did)

| Harness | How it did | The one-line takeaway |
|---|---|---|
| **aider** | Worked on **every** model (weak, strong, and weird) | The reliable all-rounder — see below |
| **ollama** (our bare-bones control) | Mediocre-to-good, scaled with the model | A useful "floor": this is what almost-no-harness gets you |
| **pi / hermes / goose** | Great on one model, **zero** on the others | Powerful but fragile — they only work in the right conditions |
| **codex** | **Zero. On all 77 runs.** | A perfect example of the harness being the broken part |
| **claude** (frontier reference) | Perfect (1.0), but costs real money | The quality ceiling — at ~$1.40 a run vs. free locally |

### Three lessons a beginner should take away

**1. A harness can be the broken part — not the model.** `codex` scored **0 out of 77**. But the
model wasn't too dumb to solve the tasks. `codex` expects the model to "speak" a very specific
structured language (its tool-call protocol), and these small local models don't speak it — so
`codex` just throws up its hands (`"unsupported tool call"`) and produces nothing. Same model in
`aider` solves the task fine. This is *exactly* the blind spot ordinary benchmarks miss: they'd
blame the model, when the harness is what failed.

**2. How a model *talks* can break a harness — not just how smart it is.** Two of our models
(`deepseek-r1`) "think out loud" — they narrate a long chain of reasoning in `<think>…</think>`
before giving an answer. The same harnesses that scored ~1.0 on `qwen3:8b` (which answers cleanly)
scored **0** on these — but when we opened the logs, they'd failed in *different* ways: `pi` and
`goose` received the model's reply just fine but couldn't turn that rambling, reasoning-heavy output
into an actual file edit; `hermes` couldn't even complete a call to the model at all. Only the
tolerant harnesses (`aider`, `ollama`) coped with the messy output and still got the work done.
Two lessons: a good harness has to survive *messy* model output, not just *smart* model output —
and a bare "it scored 0" can hide very different underlying failures, which is why we read the
traces instead of guessing. That robustness is why **aider** was the standout — the only lean
harness that cleared every model we threw at it.

**3. The safety gate isn't decorative — it fired.** Remember Safety multiplies the whole score to 0
if a harness breaks a rule? It caught more than the dummy baseline this time. Even `aider`, our best
performer, occasionally wrote somewhere it shouldn't and got a run zeroed. A harness that *finishes
the task* can still lose the whole run to a boundary violation — which is precisely what you want a
safety gate to surface, instead of letting a good result hide a rule-break.

### And don't forget cost & time

"It worked" isn't the whole picture. `goose` looked great on one model — but **timed out 18 times**
getting there (it kept retrying tasks it couldn't finish in the time budget). And `claude` was
flawless but costs real money per run, while the local harnesses are free. Crucible always shows you
the bill next to the grade, so a slow or pricey "win" can't masquerade as a cheap one.

---

## 10. Want to test your own harness or task?

It's deliberately simple:

- **Add a harness** → drop a script `adapters/myharness.sh`. It's handed a working directory, the
  try number, and a feedback file; it reads `TASK.md`, edits files to solve the task, and exits.
  That's the whole contract.
- **Add a task** → make a folder with a `TASK.md` (the goal) and a `verify.sh` (a script that exits
  0 if solved, 2 if not). Add a `task.yaml` for budgets/tier, and optionally a `checkpoints.sh`
  (partial-credit milestones) and `policy.json` (safety rules). See `crucible/SPEC.md` for details.

---

## 11. Mini-glossary

- **Model** — the raw AI (e.g. `qwen3:8b`, Claude). Produces text; forgets between calls.
- **Harness** — the scaffolding that turns a model into an agent (tools, loop, memory, safety).
- **Adapter** — the small script that lets Crucible drive a particular harness.
- **Task** — a problem with an automatic checker.
- **Run / cell** — one attempt at `(harness × model × task × seed)`.
- **Oracle / verifier** — the deterministic checker that decides pass/fail (no AI judging).
- **Trace** — the step-by-step record of a run.
- **Gate** — a score multiplier (safety) that can drive the whole score to 0.

---

## 12. Go deeper

- [`crucible/README.md`](../crucible/README.md) — the technical overview.
- [`crucible/SPEC.md`](../crucible/SPEC.md) — the exact, portable benchmark rules.
- [`docs/crucible-results.md`](./crucible-results.md) — results + methodology.
- [`docs/harness-first-principles.md`](./harness-first-principles.md) — the deep "why," from
  first principles (and the research it's built on).
