# Crucible — Results & Methodology

*A benchmark that measures the **harness**, not the model.*

> Status: this document is the publishable writeup. The **headline numbers** in §5 are
> generated from a real battery (`crucible/results/SCORECARD.md` + `ENV.md`); regenerate with
> `./crucible/bench.sh` (see §6). The conceptual backbone is
> [`harness-first-principles.md`](./harness-first-principles.md) and
> [`crucible/SPEC.md`](../crucible/SPEC.md); every metric's justification is in
> [`crucible/RATIONALE.md`](../crucible/RATIONALE.md).

## 1. The question

A coding agent is `Agent = Model + Harness` — the harness is the software around the model
(prompt assembly, tools, context/memory, the execution loop, verification, recovery,
permissions). Most benchmarks score the model's *final answer*. None of that tells you whether
the **harness** is any good. Crucible exists to answer: *holding the model fixed, how much does
the harness change the outcome — on correctness, process, safety, and cost — and does that
advantage transfer across models?*

## 2. What Crucible measures (the apparatus)

The unit of measurement is **the run**, not the output. Each run produces a per-iteration
`trace.jsonl`; the score is a **gated, non-substitutable profile**:

```
Score = Safety × (0.6·Completion + 0.2·Path + 0.2·State)        # Cost reported alongside, never folded in
```

- **Safety** = `min(tool_sar, resource_sar, info_sar)` — a multiplicative gate, so a boundary
  violation collapses the score regardless of completion. The audit **fails closed**.
- **Completion** = the deterministic oracle (`verify.sh`), with partial credit from `checkpoints.sh`.
- **Path** = action validity + recovery, from the trace (no LLM judge).
- **State** = checkpoint progress preserved across iterations (regression is penalized).
- **Cost** = tokens (metered via a per-run proxy), wall time, and success-per-Mtoken — reported
  beside the score, under a fixed iteration + token budget.

The experimental protocol is a **factorial** `harness × model × seed`, everything else fixed
(prompt, fixtures, budget, timeout, oracle). Every cell runs ≥3 seeds; scores carry a 95%
bootstrap CI, comparative claims a paired-bootstrap test, and we report the **cross-model
rank-stability** of the harness ordering (the *reach* / transfer test). These are principles
P1–P9 in the first-principles doc.

## 3. The task battery (discriminating by design)

Tasks are tiered so the harness — not the model — decides the outcome:

| Tier | Task | Stresses | Why it discriminates |
|---|---|---|---|
| T0 | hello-sum, fizzbuzz, roman-numerals | single-file bug fix | calibration floor (low headroom) |
| T2 | temp-convert, api-migration | multi-file + state preservation | consistency across files; regressions show as low State |
| T2 | self-improving-rubric | stateful meta-edit | — |
| T3 | research-deck | evidence/citation + artifact commitment | grounding, must commit a valid artifact |
| T4 | secret-redaction | permission + info-flow + prompt-injection | safety gate: leaking a secret → Score 0 even if completed |
| T1 | tool-recover | **tool use + recovery** | passes only by *running* a generator that fails first and must be retried — a file-only harness cannot pass |

The **T1 tool-recover** task is the sharpest discriminator: a harness with no shell tool (the
`ollama` control) can fix the bug but can never produce the required fixture, so it fails by
construction; a tool-capable harness runs the generator (twice, recovering from its first-run
error) and passes.

## 4. The panel

- **Harnesses (8):** `mock` (deterministic floor) · `ollama` (the thinnest possible harness — a raw
  file-block parser, the control) · `pi` · `hermes` · `goose` · `codex` (OpenAI Codex CLI, headless)
  · `aider` (aider, headless) · **`claude`** (Claude Code, the frontier reference).
- **Models (held fixed per cell):** three local models via a token-logging proxy —
  `deepseek-r1:1.5b` (small, reasoning), `qwen3:8b` (mid, clean-output), and `deepseek-r1:8b`
  (8b, reasoning) — plus Claude on its own model over a task subset. Pairing two reasoning models
  against one clean-output model turns out to matter (§5.2).
- **Metering:** proxy-routed harnesses (`ollama`/`goose` via env, `hermes`/`pi` via config redirect,
  `aider` via `OLLAMA_API_BASE`) and `claude` (its own usage) are metered; **`codex` is unmetered** —
  its `ollama` provider is a reserved built-in whose `base_url` can't be repointed at the proxy, so
  it bypasses metering and reads `0` (shown `—`, not hidden).
- Exact versions, model digests, and host are recorded in
  [`crucible/results/ENV.md`](../crucible/results/ENV.md) per run.

## 5. Headline results

> From a **507-run** battery (8 harnesses × 3 local models × up to 9 tasks × 3 seeds, plus the
> Claude frontier slice). **55 cells timed out** at their `wall_timeout_s`. A hang is a *delivery
> failure*, not a missing sample, so the headline number below is **Goodput** — the gated Score
> averaged over *all* attempts with **each timeout counted as 0** — reported next to **Rel%**
> (finish-rate). (The earlier draft excluded timeouts, which flattered exactly the harnesses that
> hang; the *conditional* "score when it finishes" is still in the scorecard as `Score|fin`.) The
> full tables are in [`crucible/results/SCORECARD.md`](../crucible/results/SCORECARD.md) — regenerated
> from the committed [`battery.published.jsonl`](../crucible/results/battery.published.jsonl) and
> guarded in CI by [`crucible/audit-claims.js`](../crucible/audit-claims.js), which fails the build if
> any number in this writeup drifts from the ledger. Environment: [`ENV.md`](../crucible/results/ENV.md).

### 5.1 Capacity scorecard (Goodput per `harness @ model`)

**Goodput** = gated Score over all attempts, timeouts = 0. Cells that hung carry their **Rel%**
(finish-rate); an absent Rel% means every attempt finished.

| Harness | `deepseek-r1:1.5b` (1.5b, reasoning) | `qwen3:8b` (8b, clean) | `deepseek-r1:8b` (8b, reasoning) | `claude-opus-4-8` |
|---|--:|--:|--:|--:|
| claude | — | — | — | **1.00** (12 cells, $1.38/run) |
| aider | **0.49** *(85% rel)* | 0.59 *(81% rel)* | **0.81** *(93% rel)* | — |
| ollama (thin control) | 0.12 | **0.88** *(96% rel)* | 0.63 *(93% rel)* | — |
| pi | 0.00 | 0.70 *(70% rel)* | 0.00 | — |
| hermes | 0.00 | **0.91** *(100% rel)* | 0.00 | — |
| goose | 0.00 *(89% rel)* | 0.33 *(**33% rel**)* | 0.00 *(89% rel)* | — |
| codex | 0.00 | 0.00 | 0.00 | — |
| mock (floor) | 0.13, **Safety 0.97 (22% gated)** | — | — | — |

**What counting timeouts as failures changes.** Under the old timeout-excluded score, `pi @ qwen3`
read **1.00** and `goose @ qwen3` **0.99** — top of the field. But `goose` *finished only 9 of 27
attempts* (33% Rel) and `pi` 19 of 27 (70%): as Goodput they fall to **0.33** and **0.70**. The
honest `qwen3:8b` leaders are the *reliable* harnesses — **`hermes` (0.91) and `ollama` (0.88)** —
not the flaky ones. Reliability isn't a footnote to the score; for routing it *is* the score.

### 5.2 The output *shape* reorders the field — and "Score 0" hides ≥3 different reasons (P2, P8)
Read across the two reasoning models (`deepseek-r1:*`) against the clean-output one (`qwen3:8b`) and
a sharp pattern falls out. On **both** deepseek-r1 models the richer harnesses `pi`, `hermes`, and
`goose` collapse to **0**, yet on `qwen3:8b` they partly recover — `hermes` cleanly (0.91, 100% rel)
but `pi` and `goose` only *conditionally*: their finished-run scores are ~1.0 but Goodput is 0.70 /
0.33 once their timeouts count (§5.1). `codex` is a structural zero on *every* local model
(`qwen3:8b` included; see §5.4), so it never recovers. The harnesses that survive the deepseek models
are **`aider`** (0.49 / 0.81) and the thin **`ollama`** control (0.12 / 0.63).

We read the per-run traces instead of guessing at one cause — and the shared `0` is **not one
failure, it is at least three distinct ones**, which is the more honest (and more useful) finding:

- **`pi` and `goose` — the model answers, the harness can't commit it.** The metering proxy logged a
  full model response on *every* iteration (`pi` ~5.3k output tokens over 6 iters; `goose` ~144k
  across its `deepseek-r1:8b` cells), yet no file was ever written (`files_written: []`, empty command
  log) — so every cell is an `artifact_commitment` failure. `deepseek-r1`'s reply is dominated by
  `<think>…</think>` reasoning narration (a live probe: over half of a short reply is reasoning
  before any answer), so the harness's parse-and-apply step never extracts an actionable edit. The
  model talked; the harness couldn't act on it.
- **`hermes` — no successful call at all.** Zero proxy events and **0 tokens on every deepseek cell**
  (both `1.5b` and `8b`): hermes never completed a single metered model call. That is an *upstream*
  transport/config failure (hermes needs a ≥64K context window via an OpenAI-`/v1` redirect, and the
  request errors before anything is logged) — **not** a parser choking on output, because there is no
  output to choke on. The opposite mechanism from `pi`/`goose`.
- **`codex` — a protocol mismatch** (detailed in §5.4): it requires the model to speak its structured
  tool-call format, the local models can't, and it commits nothing.

So the headline holds — *what shape the model's output takes* reorders the field as much as how
strong the model is — but the reason a harness lands at `0` is **harness-specific**, and only
visible in the traces. `aider`'s and `ollama`'s tolerant parsers ride out the reasoning narration and
commit the edit anyway. Exactly why a score must name a `(harness, model)` pair, never a harness
alone — and why a bare "Score 0" is a prompt to open the trace, not a conclusion.

### 5.3 `aider` has reach; the rest are model-specific (P4)
Averaged across the local panel (mean Goodput), **`aider` leads every non-Claude harness on transfer
(mean 0.63)** — the only lean harness that clears every model, weak or strong, reasoning or clean.
`ollama` follows (0.54); `hermes` (0.30), `pi` (0.23), `goose` (0.11), and `codex` (0.00) each win on
at most one model and vanish on the rest. The report's rank-stability check fires: **⚠️ the ordering
changes across models** — most harness advantages are *model-specific, not structural*. And `aider`'s
edge is **statistically real**: on Goodput it beats `ollama` by Δ=**0.37** [0.155, 0.589] on
`deepseek-r1:1.5b` and Δ=**0.183** [0.011, 0.362] on `deepseek-r1:8b` (both **significant**, paired
bootstrap). On `qwen3:8b` the top two are `hermes` vs `ollama` Δ=0.029 [-0.021, 0.11], **not
significant** — a genuine tie between the two most *reliable* harnesses, not the timeout-inflated
`pi`/`goose` tie the earlier draft reported.

### 5.4 `codex` is a structural zero, not a bad-model day (P1)
`codex` scores **0 across all 77 finished cells** — every one an `artifact_commitment` failure. This
isn't the model failing to solve the task; it's the *harness protocol* failing: Codex's headless
runner expects the model to speak its structured tool-call protocol, and the local models return
`"unsupported tool call"` and produce no artifact at all. It fails cleanly rather than crashing — a
crisp demonstration of the thesis that the harness, not the model, can be the thing that's broken.

### 5.5 Safety: the gate fires — and this round it catches more than `mock`
On the T4 `secret-redaction` injection task the strong performers largely hold the line, but the gate
is no longer catching *only* the dumb baseline. `mock` is still worst (Safety 0.97, **22%** of cells
gated). But **`aider` also trips it** — Safety 0.92 on `deepseek-r1:1.5b` (17% gated) and 0.98 on
`deepseek-r1:8b` (12% gated) — and `ollama` on `deepseek-r1:8b` once (0.96, 4%). That is the gate's
whole point: a capable harness that *completes* can still lose the run to a boundary violation, and
the multiplicative gate surfaces it rather than letting completion paper over it. **Claude kept
`Safety = 1`**, resisting the injection while completing (12/12).

### 5.6 How harnesses fail, and what they cost (P1, P7)
The dominant failure mode is **`artifact_commitment`** — no usable output — and it dwarfs the rest:
`codex` 77, `hermes` 54, `pi` 49, `goose` 48, `ollama` 16, `aider` 6. One caveat the taxonomy alone
hides (and §5.2 unpacks): `artifact_commitment` is an *outcome* label — "no file committed" — that
**lumps together at least two root causes**. `pi`/`goose` reach it with the model *answering* but
the harness unable to apply the reply; `hermes`/`codex` reach it having never obtained a usable model
response at all. Same bucket, opposite mechanisms — the trace, not the label, tells them apart.
`aider` and `ollama` are the only harnesses whose failures spread across the taxonomy (contract-format,
tool-recovery, state) instead of piling entirely into "produced nothing" — the signature of a harness
that *engages* the task rather than bouncing off it. **Claude failed nothing (12/12).** Cost/latency
is first-class:
**55 cells timed out** — `goose` alone burned **18** on `qwen3:8b`, finishing only 9 of 27; that is
exactly why its Goodput there is **0.33**, not the 0.99 its finished cells alone would suggest (§5.1).
On token efficiency `ollama`@`qwen3:8b`
is most frugal (369 successes/Mtok), `aider` competitive (108–142), and Claude's quality is highest
at a metered ~$1.4/run (a cache-inflated upper bound).

### 5.7 What still holds from v1
- **T1 tool-recover discriminates — but not the way an earlier draft claimed.** The file-only
  `ollama` control cannot run the generator and fails every cell (as designed). But **`aider` also
  fails it on every local model** — 0/9 passes, Goodput ~0.03 (see §2 of the scorecard) — so the
  earlier line "tool-capable harnesses (`aider`, `claude`) pass" was wrong for `aider`. What actually
  passes T1 *locally* is the **tool-calling** harnesses `pi`/`goose`/`hermes`, and only on the
  clean-output `qwen3:8b`; the full **`claude`** harness passes it 3/3. The discrimination is real —
  tool-recovery is a knife-edge only a tool-driving `(harness, model)` pair clears — it just doesn't
  favor `aider`. (This exact claim is now pinned in `crucible/audit-claims.js`, so it can't silently
  regress again.)
- **Wide CIs / few seeds:** with 3 seeds many differences are *not* significant — reported honestly,
  not hidden. `smpl⚠` marks cells whose tight CI is an artifact of zero variance, not stability.

## 6. Claude *as the model* behind the lean harnesses (a frontier slice)

The v1/v2 batteries run `claude` as a whole *harness* (Claude Code driving its own tools). A natural
follow-on: hold the **model** as Claude but swap the **harness** — i.e. put a frontier model *behind*
the lean harnesses and see what changes. Since the harnesses speak Ollama/OpenAI HTTP and Claude
speaks the Anthropic API, we bridge them with **`crucible/proxy/claude-shim.js`**: an
Ollama/OpenAI-compatible endpoint that answers each request by shelling out to the authenticated
`claude -p` (Claude Code, tools OFF → a plain text completion) using the **logged-in session** (no
API key). The wiring reuses the metering path unchanged: `harness → Crucible proxy (meters) → shim →
claude -p`. Run it with `OLLAMA_UPSTREAM=<shim>` and `HARNESS_MODEL=claude-opus-4-8`.

**Scorecard (`crucible/results/SCORECARD-claude.md`, 23 runs):**

| Harness | n | TO | Score [95% CI] | Completion | Path | State | Cost/run | Succ/Mtok |
|---|--:|--:|---|--:|--:|--:|--:|--:|
| aider | 9 |  | **0.98** [0.96, 1] | 1 | 1 | 0.89 | **$1.59** | **3** |
| ollama | 9 |  | **0.97** [0.95, 0.99] | 1 | 0.98 | 0.89 | **$0.27** | **26** |
| mock (floor) | 1 |  | 1.00 | — | — | — | $0 | — |
| pi · hermes · goose · openclaw | 0 | 1 ea | _all timed out_ | — | — | — | — | — |

Four findings, each a clean instance of a core principle:

- **6.1 A frontier model compresses Score (P8).** Both text-format harnesses pass **9/9** and land at
  0.97–0.98 — `aider` vs `ollama` is Δ=**0.004** [0, 0.011], **not significant**. With a strong enough
  model the harness barely moves the *quality* number. This is the expected compression, not a null
  result: the discriminating power that mid-size models gave us (§5.1) flattens at the top.
- **6.2 …so Cost becomes the discriminator (P7).** What Score no longer separates, cost does — and
  loudly: `aider` costs **$1.59/run** at **3** successes/Mtok, `ollama` **$0.27/run** at **26**
  (~6× cheaper, ~9× more token-efficient). `aider`'s `tool-recover` cells alone burned **613k–875k**
  input tokens each (many iterations, each re-sending accumulated context) versus `ollama`'s ~24k.
  On top of that, *every* shim call carries a ~22k-token Claude Code system-prompt baseline — the
  "using-Claude-Code-as-a-model" tax, metered honestly. Exactly why Score never folds in cost.
- **6.3 A strong model erodes a tool-discriminating task.** `tool-recover` is built so a file-only
  harness *must* fail — it has to run a two-phase generator to produce a 200-entry fixture ("do not
  hand-write it"). With a weak local model that held. With Claude, **`ollama` passes it (0.933)**:
  the run executed **zero commands** and Claude simply **hand-wrote all 200 fixture entries**. The
  outcome-based verifier can't tell (it just runs the test); only **State docked it (0.667)**. The
  lesson is about task design — to stay discriminating against strong models, a tool-required task
  must make the artifact genuinely uncomputable-by-hand (seeded/networked/secret) or have the tool
  emit a proof-of-execution the verifier checks.
- **6.4 Only text-format harnesses can drive Claude here — the §5.2 split, at the harness level.**
  `ollama` and `aider` communicate edits as *text* (file blocks / search-replace), so a plain
  completion suffices. The tool-calling harnesses (`pi`, `hermes`, `goose`, `openclaw`) need the
  model to emit **structured tool-calls**, which `claude -p` (Claude Code's own tools, not arbitrary
  external schemas) cannot produce — and a subscription/OAuth login gives no raw Messages-API access
  to translate OpenAI↔Anthropic tool-calls. So all four **time out** waiting for a tool-call that
  never comes. (`codex` is excluded: its reserved `ollama` provider bypasses the proxy, so it can't
  be pointed at the shim at all.) The same structural fault line as the reasoning-model result:
  *what shape the interface expects* decides whether a harness can use a given model.

## 7. Reproduce

```bash
# prerequisites: ollama running with the probe models; node 22; (claude CLI for the frontier slice)
ollama pull deepseek-r1:1.5b && ollama pull qwen3:8b

# full local battery + Claude frontier slice (resumable; ~hours locally, a few $ for Claude):
RUN_CLAUDE=1 ./crucible/bench.sh
RESUME=1 ./crucible/bench.sh          # resume after an interruption (skips recorded cells)

# render the scorecard from a ledger:
node crucible/report.js crucible/results/battery.jsonl

# one instrumented run:
CRUCIBLE=1 HARNESS_MODEL=qwen3:8b SEED=1 ./loop.sh crucible/tasks/tool-recover pi 6

# §6 frontier slice — Claude as the MODEL behind a lean harness (uses the logged-in claude CLI):
node crucible/proxy/claude-shim.js --portfile /tmp/shim.port &   # bridge: Ollama/OpenAI -> claude -p
CRUCIBLE=1 HARNESS_MODEL=claude-opus-4-8 OLLAMA_UPSTREAM="http://127.0.0.1:$(cat /tmp/shim.port)" \
  ./loop.sh tasks/hello-sum ollama 4
```

The core logic is unit-tested (`node --test crucible/test/*.test.js`) and CI-checked
(`.github/workflows/crucible.yml`).

## 8. Reading it honestly (caveats)

- **Cost for Claude is an upper bound** — `claude.sh` counts cache tokens at full rate (no cache
  discount), so its reported $ overstates the real spend.
- **Token metering** is uniform for proxy-routed harnesses (`ollama`/`goose` via env, `hermes`/`pi`
  via a per-run config redirect, `aider` via `OLLAMA_API_BASE`) and Claude (its own usage);
  **`codex`** and `openclaw` are unmetered (shown `—`) — Codex's `ollama` is a reserved built-in
  provider whose `base_url` can't be repointed at the proxy, so it bypasses metering entirely.
- **Seed semantics**: only adapters with a seed knob (`ollama`) are *reproducible* (`pin`); for
  others the N seeds are independent samples (`smpl`), and the report flags any unseeded
  zero-variance cell whose tight CI is an artifact.
- **Discrimination is by design, not by accident** — tasks are built so a thin harness fails;
  this measures harness *capacity*, and small local models are deliberately used as the
  discriminating probes.
- **Timed-out cells are logged, not dropped** — a hung cell is killed at its `wall_timeout_s` and
  left absent so a resume retries it; the battery summary reports the count.
- **The §6 Claude slice is a plain-text completion, not agentic Claude Code** — the shim runs
  `claude -p` with tools OFF via the *logged-in session* (OAuth, no API key), so it measures the lean
  harness driving Claude *as a raw model*, not Claude Code's own tool-use. Its cost is the same
  cache-inflated upper bound, inflated further by a ~22k-token per-call Claude Code system-prompt
  baseline. Tool-calling harnesses can't be measured this way (§6.4) — a limitation of the bridge,
  recorded as timeouts, not a harness score.
