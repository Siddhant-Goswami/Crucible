# qwen3.5:9b bookend — probe chain & codex dialect diagnosis (2026-07-02)

> Running notes for the §5A.3 (H3a-local) cells. Ledger: `qwen35-pilot.jsonl` (separate from the
> frozen `battery.published.jsonl`). Status: exploratory (amendment 5A written before these runs).

## Model probes (all on Ollama, digest `6488c96fa5fa`, 6.6GB)

| Probe | Result |
|---|---|
| `/api/generate` default | thinking ON, delivered in a **separate `thinking` field**; `response` clean |
| `/api/generate` `think:false` | thinking absent; 14-token answer in ~1.1s |
| `/v1/chat/completions` default | `content` clean; reasoning in a separate `reasoning` field |
| `/v1/chat/completions` + `tools` | well-formed `tool_calls`, `finish_reason:"tool_calls"` |
| `/v1/responses` (no tools) | works; reasoning as separate output item |
| `/v1/responses` + function tool | `function_call` output item with correct name/args |
| `/v1/responses` + `local_shell` tool | HTTP 200, tool echoed schema-less, model still attempts a call |
| `qwen3:8b` same stack | **also** separates thinking — the pilot's "clean-output" designation was a (template × serving-layer) property, not model propensity (⇒ 5A.2) |
| Crucible pipeline shakedown | `ollama@qwen3.5:9b` on hello-sum: pass, 1 iter, 9.8s, metered 568/35 tok |

## codex @ qwen3.5:9b — the dialect chain, link by link

1. **`--oss` path (the registered arm, in `qwen35-pilot.jsonl`):** engages the model (reasoning +
   a plan come back; stray `</think>` markers leak into codex's rendering) but **no tool call ever
   executes** — 6 iters, `files_written: []`, `artifact_commitment`, score 0. codex's local
   provider expects the **gpt-oss harmony dialect**, which qwen3.5 does not speak.
2. **Custom provider, `wire_api="chat"`:** rejected — codex CLI 0.137.0 removed the chat wire API.
3. **Custom provider, `wire_api="responses"`:** transport works (Ollama serves `/v1/responses`),
   the model answers coherently — but emits a **bash block as prose** instead of a codex tool
   call; codex executes nothing. Yet the same endpoint with a plain function tool produces a
   correct `function_call` (probe above), so the break is in codex's own tool dialect
   (`local_shell` / `apply_patch` custom grammar / streaming), not in the model's capability.

**Reading (updates the naive 5A.3 prediction — partial refutation, sharper mechanism):**
"protocol availability" is not one bit. It is a **dialect chain** —
`harness wire-API × serving-layer translation × model template` — and codex fails at a chain
link even when the model demonstrably emits perfect standard tool calls. Interface-fit binds at
the *weakest link of the chain*, and some harnesses pin their chain to their home ecosystem
(harmony/Responses+custom tools), making them structurally local-incompatible regardless of
model quality. The discriminating arm is now **pi/hermes/goose @ qwen3.5:9b** (queued): if the
generic OpenAI-dialect harnesses recover where codex cannot, the dialect-chain mechanism is
demonstrated entirely locally.

**Side discovery (metering):** codex accepts custom Responses-API providers by config — pointed
at the Crucible proxy this would close the long-documented codex metering blind spot, *if* a
Responses-capable translation is added to the proxy (it currently meters `/api/*` and
`/v1/chat/completions`; `/v1/responses` usage fields differ: `input_tokens`/`output_tokens`).

## Think-ON arm results (48 rows, `qwen35-pilot.jsonl`) — and its confound

| Harness | tool-recover | api-migration | secret-redaction | temp-convert |
|---|---|---|---|---|
| pi | **1.0 / 0.94 / 1.0** | 0/3 TO | 0/3 TO | 0/3 TO |
| hermes | 0/3 (engaged, no commit) | 0/3 TO | 0/3 TO | 0/3 TO |
| goose | 0/3 TO | 0/3 TO | 0/3 TO | 0/3 TO |
| codex | 0/3 (dialect) | 0/3 | 0/3 | 0/3 |

- **pi's T1 sweep is the arm's positive result**: first perfect local tool-recover sweep on any
  model — the generic OpenAI-dialect harness converts qwen3.5's tool calls where codex cannot.
- **30/36 tool-caller cells timed out.** Direct evidence of runaway thinking exists for
  `api-migration pi s1`: one `/v1/chat/completions` request spanning the entire 600s budget
  (server log `15:37:50 | 500 | 9m58s`). The effective think mode was the serving default (ON
  via `/v1`) — the §5A.2 mode-pinning hazard, live.
- **CONFOUND (do not read the timeout wall as pure thinking-runaway):** by battery end the host
  was deep in swap (8.7/9.2GB used) and the served model was wedged — post-battery probes of a
  trivial prompt hung >90s until the model was unloaded/reloaded (then 22.3 tok/s). Late-arm
  timeouts are therefore (thinking × host-thrash) mixed. Disentangling design: (a) think-OFF arm
  on a recovered host (`qwen35-think-off.jsonl`, CRZ_THINK=false); (b) a think-ON replication
  slice (api-migration × pi × 3 seeds) on a recovered host. If the replication still spirals,
  thinking is the driver; if it sails, arm 1's timeouts were host-state — either way the
  timeout-autopsy attribution framework (TIMEOUT-AUTOPSY.md) applies.

## Think-OFF arm (36 rows, `qwen35-think-off.jsonl`) + think-ON replication — the verdict

| Harness | tool-recover | api-migration | secret-redaction | temp-convert | Goodput |
|---|---|---|---|---|---|
| pi | **1.0×3** | TO, TO, **0.967** | **1.0×3** | **1.0×3** | **≈0.83** |
| hermes | 0×3 fin | 0×3 fin | 0×3 fin | 0×3 fin | 0 |
| goose | TO, 0, 0 | 0.017, 0, 0 | 0×3 fin | 0, 0.04, 0 | ≈0.005 |

- Tool-caller timeouts fell **30/36 → 3/36**. `pi @ qwen3.5:9b` (think off) is the strongest
  local tool-calling pair measured in this program.
- **Think-ON replication slice** (`qwen35-think-on-repl.jsonl`, api-migration × pi × 3, healthy
  host, think pinned true): **1.0 / 0.883 / 1.0, zero timeouts** — the same cells that were
  0/3 all-timeout in arm 1, and BETTER than think-off's TO/TO/0.967 on the same task.
- **Verdict on arm 1's timeout wall: host-state artifact, not a thinking spiral.** By arm-1's
  end the host was 8.7GB deep in swap and the model runner wedged; the "10-minute generation"
  is consistent with an ordinary-length thinking reply at thrash-collapsed tok/s (~2–5 tok/s)
  rather than a runaway (healthy rate: 22 tok/s ⇒ 600s ≈ 13k tokens). On a healthy host,
  thinking *helps* pi converge (fewer, smarter internal iterations) — its cost is
  host-throughput-conditional, its benefit is convergence.
- `pi`'s residual think-off api-migration timeouts are its own **internal-loop non-convergence**
  (server log: back-to-back ~15–26s completions until the kill — ~30 calls, no exit), a
  harness-attributable wall-clock failure mode distinct from both hangs and slow generation.
- `hermes` 0/24 across both arms is a **serving-context fault**, not capability: it sends a
  constant 2050-token (truncated) prompt because Ollama loads qwen3.5:9b at default num_ctx
  4096 and hermes' ollama_num_ctx preload silently fails for this model. Fix + re-run queued.

**Methodological consequence (new, for §5A.1 and the paper's methods section):** wall-clock
Goodput on a memory-constrained host is **non-stationary** — the host degrades as a battery
runs, so *cell order becomes a confound* (late cells time out more). We nearly published
"thinking spirals on medium prompts"; it was swap. The scaled battery must: (a) record host
health per cell (swap-used + a tok/s canary), (b) randomize/interleave cell order across arms,
(c) health-gate between tiers (unload model, require canary ≥ threshold), and (d) extend the
timeout autopsy with a HOST_DEGRADED class (cut-off-working while the canary was below bar).

## hermes patched slice (`qwen35-hermes-fix.jsonl`, 2026-07-03) — the zero migrates classes

Fix: derived tag `qwen35-9b-ctx16k` (`FROM qwen3.5:9b` + `PARAMETER num_ctx 16384`; same weights,
digest-verified full-prompt evaluation of 6017 tokens). Evidence for the fault: hermes' own
request dump shows it SENDS the full ~5.3k-token request (20k-char system prompt, 25 tools,
`max_tokens: 65536`) — the truncation was server-side (num_ctx 4096 default).

Result: **0/12 passes, 0 timeouts, 12/12 `budget_exhausted`**, 97k–195k input tokens per cell
(best partials 0.05/0.033). Post-fix hermes engages fully and iterates hard, but its
context-resend loop exhausts every task's token budget without converging on this model —
while the same harness was the **top qwen3:8b pair (0.91)** in the pilot.

Reading: the fix migrated hermes' zero from *infrastructure* (truncated transport — not a
measurement of the harness at all) to **token-overbudget** — the host-independent,
harness-attributable class of the timeout-autopsy taxonomy. With this slice, every class in that
taxonomy now has a live population in the qwen3.5 study: **hang** (codex, dialect chain),
**wall-clock-within-budget** (arm-1 host thrash), **token-overbudget** (hermes patched). Same
Goodput 0; three different owners; only trajectory evidence tells them apart — the study's
thesis in one row of failures. (H2 corollary: hermes' advantage on qwen3:8b did not transfer
one generation forward within the same family.)

## Think-mode pinning (implemented 2026-07-02)

`CRZ_THINK=true|false` on the metering proxy injects per endpoint: native `/api/chat|generate`
→ `think` (honored); OpenAI-compat `/v1/*` → `reasoning_effort` (`"none"` verified to suppress
reasoning on qwen3.5; plain `think` is IGNORED on `/v1`). The pinned mode is recorded per run
(`think` field via finalize.js); unset = passthrough + `think: null` (unpinned serving default).
Qwen's `/no_think` soft toggle does NOT work on qwen3.5 (575 reasoning tokens anyway).
