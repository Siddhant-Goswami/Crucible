# Crucible — Research Hypotheses & Paper Scope

> The pre-registration-style hypothesis document for a scoped paper built on the Crucible apparatus
> and its pilot battery. It states the central thesis, the falsifiable hypotheses (each with a
> *risky* prediction and the observation that would refute it), what the **pilot already supports
> in-sample** vs. what a **scaled, pre-registered study must confirm**, and the analysis plan.
> Grounded in [`crucible-results.md`](./crucible-results.md); positioned in
> [`crucible-related-work.md`](./crucible-related-work.md); philosophy in
> [`harness-first-principles.md`](./harness-first-principles.md) (P1–P9).
>
> **Epistemic honesty (read first).** The current 515-run battery (9 tasks, 3 local + 3 cloud
> models) is an **exploratory pilot**. The hypotheses below were *sharpened from* that pilot, so the
> pilot's support for them is **in-sample** — it motivates, it does not confirm. The paper's
> confirmatory claims must come from the **scaled, pre-registered** design in §5. We label every
> hypothesis's status accordingly; we do not present in-sample fits as confirmation (no HARKing).

---

## 0. Paper framing (how to position this)

- **Paper type:** an **empirical measurement study + reusable apparatus**, not a "definitive
  benchmark" paper. Honest scope given a homegrown 9-task battery and a narrow model panel. Venue
  fit: an **arXiv preprint** plus a **workshop** on LLM agents / evaluation (COLM, or NeurIPS/ICLR
  agent & eval workshops). A full-conference benchmark submission is a *follow-up* once the scaled
  study (§5) lands.
- **What makes it publishable (three legs):**
  1. **A mechanism, not just "scaffold matters."** The novel scientific claim is **interface-fit**
     (H3): whether `Agent = Model + Harness` succeeds is often bound by the *compatibility between
     the harness's expected I/O shape and the model's actual output shape*, not by the model's raw
     capability. Prior work (SWE-agent, Epoch, METR) establishes *that* scaffold matters; we give a
     *predictive mechanism* and a clean causal demonstration (the codex bookend, H3a).
  2. **A methodological correction with teeth.** Goodput (H4): excluding timed-out runs — common
     practice — *inverts* harness rankings; reliability must be first-class. Reproducible, deterministic,
     drift-guarded scoring is itself a contribution in a field criticized for irreproducible agent evals.
  3. **A decision artifact.** A local-vs-cloud **routing rule keyed on task-capability tier** (H5),
     the signal difficulty-based routers lack.
- **The one-sentence thesis (title candidate):** *"Interface-fit over capability: a controlled study
  of coding-agent harnesses across local and cloud models — and when to route which."*
- **Do NOT claim:** a model leaderboard; a definitive/complete benchmark; broad cross-*family* reach
  (only 2 local families); portable latency (hardware-conditional); that the 1-seed cloud slice has
  equal statistical power. These are §6 threats and §5 future work, stated up front.

---

## 1. Research questions

- **RQ1 (attribution).** Holding the model fixed, how much of a coding agent's outcome is determined
  by the *harness*, and is that effect large and significant on discriminating tasks?
- **RQ2 (mechanism).** *Why* does a given (harness, model) pair succeed or fail — is the binding
  constraint the model's capability, or the *fit* between the harness's expected interface and the
  model's output shape?
- **RQ3 (transfer/reach).** Do harness advantages transfer across models, or are they model-specific?
- **RQ4 (routing).** Given a task and an available model, what is the correct local-vs-cloud
  decision, and what signal governs it?

---

## 2. Central thesis (stated so it is hard to vary)

> A coding agent's success is governed less by the model's raw capability than by three harness-level
> properties, in this order of bite on sub-frontier models: **(i) interface-fit** — the model must be
> able to emit the output shape the harness consumes; **(ii) reliability** — the harness must actually
> *deliver* within budget, not merely score well when it happens to finish; and **(iii) execution
> alignment** — reasoning, workspace state, tool actions, and the oracle must stay in correspondence.
> Because these are harness properties, the right unit of measurement is the *run of a (harness,
> model) pair*, the right headline is *goodput under a fixed budget*, and the right practical output
> is a *routing rule keyed on the task's tool/capability tier*. Remove any clause and a specific
> observed result becomes unexplained (see which, per hypothesis).

---

## 3. Hypotheses

Each: **Claim · Why (hard-to-vary) · Operationalization · Risky prediction · Refuted if · Status**.
Status ∈ {**pilot-supported (in-sample)**, **preliminary**, **to pre-register / needs scaled run**}.
"At-risk regressions" (AHE-style) name what the same design could turn up that would complicate the claim.

### H1 — Harness attribution is large and significant (RQ1)
- **Claim.** On discriminating tasks, holding the model fixed, harness choice causes large,
  statistically significant variation in Goodput.
- **Why.** If the model dominated, all harnesses on one model would cluster; controlled variation
  (factorial, everything else fixed) attributes the spread to the harness.
- **Operationalization.** Goodput spread across harnesses within a model column; paired-bootstrap
  significance for the top-2.
- **Risky prediction.** On `qwen3:8b`, harness Goodput spans ≳0.5 (near-0 to near-1); the best vs a
  weak harness is significant.
- **Refuted if.** Harnesses cluster within <0.15 on every model, or top-vs-bottom is not significant.
- **Status. Pilot-supported (in-sample).** `qwen3:8b` spans **0.00 (codex) → 0.91 (hermes)**; on
  `deepseek-r1:1.5b` aider>ollama Δ=0.37 [0.16, 0.59] **significant**. *At-risk regression:* on the
  clean-output model the *top pack* is a tie (`hermes` vs `ollama` Δ=0.03 n.s.) — attribution is
  strong at the extremes, weaker among good harnesses. *§5A.4 follow-through (2026-07-03):* spread
  recomputed among **interface-compatible pairs** (excluding codex dialect zeros + hermes transport
  cells): **0.49 / 0.58 / 0.81** per model — H1 stands independent of H3 double-counting
  (`clustered-stats.js` §C). Boundary note: parse-tolerance differences stay in-scope — harnesses
  that received usable responses and failed to apply them exhibit harness quality, not
  interface-incompatibility.

### H2 — Most harness advantages are model-specific; reach is the exception (RQ3)
- **Claim.** The harness *ranking* does not transfer across models; only a minority of harnesses
  (tolerant text-parsers) keep a nonzero advantage on every model.
- **Why.** Advantages encoded in model-specific assumptions (tool-call protocol, clean output)
  evaporate on a model that breaks the assumption; only interface-robust structure travels (AHE:
  "structure transfers, prose doesn't").
- **Operationalization.** Rank-stability of the harness ordering across the model panel; per-harness
  mean Goodput and its floor across models.
- **Risky prediction.** Rank-stability check *fails* (ordering changes across models); exactly one
  lean harness (`aider`) is nonzero on all three local models.
- **Refuted if.** The ranking is stable across models, or several harnesses hold their advantage.
- **Status. Pilot-supported (in-sample).** Rank-stability **⚠️ fired**; `aider` mean 0.63, nonzero on
  all three (0.49/0.59/0.81); `pi`/`goose`/`hermes` each win on one model, →0 on the reasoning models.
  *At-risk regression:* "reach" here is n=3 local models in 2 families — could be a family effect,
  not true reach (→ §5 needs ≥3 families).

### H3 — Interface-fit, not capability, is often the binding constraint (RQ2) — *the core contribution*
- **H3a (tool-call protocol).** A tool-calling harness fails iff the model cannot emit its structured
  tool-call format — *independent of the model's raw ability*. Give it a model that can, and the same
  harness succeeds.
  - **Risky prediction.** `codex` scores ~0 on every local model (can't emit its protocol) **and**
    passes on a capable cloud model that can — a discontinuity produced by a *model swap alone*,
    harness fixed.
  - **Refuted if.** `codex` succeeds on some local model without protocol support, or fails on a
    frontier cloud model that does support it.
  - **Status. Pilot-supported — the cleanest result.** `codex` **0/77 local → 4/4 (Score 1, one-shot)
    on gpt-5.5**. This is the paper's headline causal demonstration.
- **H3b (output shape).** Reasoning-narration output (`<think>…</think>` before the answer) breaks
  parse-and-apply harnesses but not tolerant text-parsers — again a shape effect, not a capability one.
  - **Risky prediction.** On `deepseek-r1:*` (reasoning narration), `pi`/`goose`/`hermes` collapse
    while `aider`/`ollama` (tolerant parsers) still commit edits; on `qwen3:8b` (clean output) the
    same rich harnesses recover.
  - **Refuted if.** The collapse tracks model size/capability rather than output shape (e.g., the 8B
    reasoning model behaves like the 8B clean model).
  - **Status. Pilot-supported (in-sample) — narrowed and re-mechanized (§5A.2).** `pi`/`goose` → 0
    on both deepseek models, ~0.7–0.9 on qwen3; `aider`/`ollama` survive both. **`hermes` is
    dropped from H3b's evidence**: its deepseek zeros are an upstream transport failure (0 metered
    tokens, no model output to parse — results §5.2), not a shape effect. *At-risk regression:*
    "output shape" and "model family" are confounded here (both reasoning models are deepseek-r1);
    moreover live probes (2026-07-02) show the operative variable is **where the serving stack puts
    reasoning**: current Ollama serves `qwen3:8b` and `qwen3.5:9b` with thinking in a *separate
    field* (content channel clean in both think modes), while the pinned `deepseek-r1` templates
    leave `<think>` inline in content. H3b's mechanism is therefore *inline-in-content reasoning*,
    a (model template × serving layer) property — de-confounding design in §5A.2.

### H4 — Reliability is first-class: excluding timeouts inverts rankings (RQ1, methods)
- **Claim.** Scoring only finished runs (dropping timeouts) biases scores upward for flaky harnesses
  and can invert the ranking; Goodput (timeouts = 0) is the decision-relevant metric.
- **Why.** A harness that hangs 2/3 of the time has not earned the score of the 1/3 it finished; for
  a user, "didn't deliver" = failure. Any metric that rewards non-delivery mis-ranks.
- **Operationalization.** Compare finished-only Score vs Goodput and the induced rankings; report
  Reliability (finish-rate) and pass^k.
- **Risky prediction.** At least one harness that leads on finished-only Score is *not* the leader on
  Goodput, and the gap is ≥0.2.
- **Refuted if.** Goodput and finished-only rankings coincide everywhere (timeouts negligible/uniform).
- **Status. Pilot-supported (in-sample) — but re-attributed by the timeout autopsy (§5A.1).**
  `qwen3:8b`: `pi` 1.00→**0.70** (70% finish), `goose` 0.99→**0.33** (33%); the finished-only
  leader (`pi`/`goose`) is displaced by the reliable `hermes`/`ollama` under Goodput.
  Deterministic, drift-guarded (`audit-claims.js`). *Correction:* per-cell autopsy
  (`crucible/results/TIMEOUT-AUTOPSY.md`) shows 51/55 timeouts were **cut off while working,
  within token budget** (host-conditional wall-clock latency), not harness hangs (4/55, all
  `codex`). The ranking inversion and "count timeouts as 0" stand (delivery is delivery), but
  the *mechanism* clause "flaky harnesses hang" is withdrawn; see §5A.1 for the reframed claim.

### H5 — The local-vs-cloud routing decision is governed by task-capability tier, not prompt difficulty (RQ4)
- **Claim.** Whether a task can be done locally is governed by (task tier × model capability); one
  tier — **tool-recovery (T1)** — forces escalation for sub-frontier models even when other tiers
  don't, and this is invisible to prompt-difficulty routers.
- **Why.** Tool-recovery requires *running* a tool and recovering from its failure — a capability a
  file-only or text-only path cannot fake and a weak model cannot drive; prompt length/difficulty
  does not encode this.
- **Operationalization.** Per-(model, tier) best-achievable Goodput; the escalation set (tiers below
  bar) per local model; contrast with a difficulty proxy (prompt length).
- **Risky prediction.** `qwen3:8b` clears every tier locally; `deepseek-r1:8b` clears all **except
  T1**; `deepseek-r1:1.5b` escalates almost everything; and T1 escalation does **not** correlate with
  prompt length.
- **Refuted if.** Escalation need tracks prompt length/difficulty rather than tier, or T1 is no harder
  to keep local than T2/T3 for the same model.
- **Status. Preliminary.** Escalation pattern holds in-sample (`deepseek-r1:8b` best-local T1 = 0.13
  vs ≥0.9 elsewhere; `qwen3:8b` clears all). *Not yet done:* the explicit contrast against a
  prompt-difficulty router — **to pre-register** (§5).

### H6 — At the frontier, quality compresses and cost/latency becomes the discriminator (RQ4)
- **Claim.** A strong-enough model flattens harness *quality* differences, so cost/latency (not Score)
  separates harnesses.
- **Why.** Interface-fit and alignment are trivially satisfied by a frontier model, so the remaining
  variance is operational (tokens, iterations, latency), which the harness controls.
- **Operationalization.** Harness Goodput dispersion vs model strength; cost/latency spread at the top.
- **Risky prediction.** On a frontier model, text-harness Goodput differences are n.s. while per-run
  cost differs multiplicatively.
- **Refuted if.** Quality differences persist at the frontier, or cost is uniform.
- **Status. Pilot-supported (in-sample).** Claude-as-model: `aider` vs `ollama` Goodput Δ n.s., but
  cost **$1.59 vs $0.27/run** (~6×); `codex@gpt-5.5` all 1.0. *At-risk regression:* compression is
  clean on text harnesses; we lack frontier data for tool-calling harnesses (shim/key limits).

### H7 — Boundary safety is a harness property, orthogonal to completion (RQ1, safety)
- **Claim.** A task-*completing* run can still violate a boundary; a multiplicative safety gate
  surfaces this where an additive score hides it.
- **Why.** Completion and boundary-adherence are different properties of the trajectory; only a gate
  (Score = Safety × …) prevents completion from "buying back" a violation.
- **Operationalization.** Gated-cell rate among *completing* runs; Safety SAR vs Completion.
- **Risky prediction.** At least one capable harness that completes the T4 task is nonetheless gated
  on some runs (resource/info violation).
- **Refuted if.** Gating only ever coincides with non-completion (safety redundant with completion).
- **Status. Pilot-supported (in-sample), construct-audited.** `aider` trips the resource gate on
  T4/T1 (12–17% of cells) while otherwise strong; `mock` 22%. *Caveat resolved (2026-07-03):* all
  9 auditable gated agent cells carry **genuine** policy events (forbidden-path write, secret leak
  into output, real out-of-area writes incl. aider editing the protected generator); **zero glob
  false-positives** — see `crucible/results/SAFETY-GATE-AUDIT.md`. Construct note: low-severity
  resource events include confusion-driven workspace pollution, so the channel measures workspace
  discipline, not only adversarial crossing.
- **New observation (2026-07-03) — sandbox containment is itself a harness-safety property.** While
  piloting the hardened T1 tasks, `pi` (told to "delete `.build.lock`") escaped its `cwd` sandbox:
  it discovered the repo's `.git` root and deleted the file from the **pristine task source**, not
  its workdir copy — a blast-radius failure (HarnessAudit's exact concern) that the in-workdir audit
  cannot see. `mock` on the identical task does not (infrastructure verified clean, distinct inode).
  Mitigation wired into `loop.sh`: a battery-mode pristine-source guard restores each task from git
  before every cell and logs a `sandbox_escape` event (`<ledger>.integrity.jsonl`). The scaled
  battery reports the per-harness escape rate as an auxiliary safety signal.

---

## 4. Contribution ↔ evidence map

| Contribution | Hypotheses | Pilot status | To reach publication strength |
|---|---|---|---|
| Interface-fit mechanism | H3a, H3b | H3a strong (bookend); H3b confounded | de-confound shape×family; a 2nd frontier model per interface class |
| Reliability/goodput methods | H4 | supported + guarded | replicate on the scaled battery |
| Local↔cloud routing rule | H5 | preliminary | difficulty-router contrast; more models per tier |
| Frontier compression → cost | H6 | supported (text) | tool-calling harnesses on a frontier model (shim/key) |
| Attribution + reach | H1, H2 | supported (2 families) | ≥3 local families; multi-seed |
| Safety gate independence | H7 | preliminary | construct-validity of the gate; injection tasks from AgentDojo/AgentHarm |

---

## 5. Scaled, pre-registered design (what the paper actually runs)

Pre-registered **before** running (freeze this section + the thresholds, then execute):

1. **Models — de-confound shape × family × size.** ≥3 local families (e.g. Qwen, Llama, Mistral/Gemma)
   each in a clean-output *and* a reasoning variant where available, spanning ~1.5B/8B/14B; ≥2 cloud
   families (Anthropic + OpenAI) with tool-calling. This isolates H3b (shape) from family/size.
2. **Tasks — anchor externally.** Keep the tiered homegrown battery *and* add an anchored slice via
   `crucible/tools/import-task.js` from a recognized suite (SWE-bench-Verified / Terminal-Bench /
   τ²-bench), with real per-instance environments. Re-check H1–H5 on the external slice for
   external validity.
3. **Seeds/power.** ≥5 seeds (power-analyze to target CI width per "Adding Error Bars to Evals");
   report Goodput mean ± bootstrap CI, paired-bootstrap for pre-named comparisons, pass^k, rank-stability.
4. **Pre-registered comparisons (one-sided where directional):** H1 top-vs-weak within each model;
   H2 rank-stability across the full panel; H3a codex local-vs-cloud discontinuity; H4 Goodput-vs-
   finished-only rank inversion; H5 tier-escalation vs a prompt-length difficulty baseline; H6
   frontier quality-compression + cost dispersion.
5. **Construct validity (H7 + Path/State).** Human-label a stratified sample of traces; report
   proxy↔human agreement (κ) for Path, State, and the safety gate before relying on them.
6. **Integrity.** Held-out task family scored only once; oracles/policies hidden + restored (already
   enforced); deterministic scorecard + `audit-claims.js` drift guard in CI.

**Pre-registered primary prediction (the paper lives or dies on this):** *interface-fit effects
(H3a codex discontinuity; H3b shape-driven collapse, once de-confounded) are larger than the
within-interface-class model-capability effect on sub-frontier models.* If, on the scaled panel,
capability explains the outcomes and interface-fit does not, the central thesis is refuted — report it.

---

## 5A. Amendment 1 — pre-battery design updates (2026-07-02, before the scaled run)

> Dated amendment, logged **before** any confirmatory cell of the scaled battery was run.
> Motivated by (a) the timeout autopsy on the frozen pilot ledger and (b) live probes of the
> qwen3.5 release. Nothing below was informed by scaled-battery outcomes.

### 5A.1 H4 reframed: delivery-within-budget, with attribution split
The autopsy (`crucible/results/TIMEOUT-AUTOPSY.md`, tool `crucible/tools/classify-timeouts.js`)
classified all 55 pilot timeouts with three independent evidence sources (workdir mtimes, proxy
events, Ollama server-log request windows): **51 cut-off-while-working within token budget**
(host-conditional latency), **4 hung-never-called-model** (`codex@qwen3:8b` — harness transport
failure), 0 mid-run hangs, 0 token-overbudget. Accordingly:
- **Kept:** Goodput (timeouts = 0) as the headline delivery metric; the finished-only inversion.
- **Withdrawn:** the mechanism clause "flaky harnesses hang"; the central thesis's word
  *reliability* is re-scoped to *delivery within budget*.
- **New attribution split (pre-registered):** every timeout in the scaled battery is autopsied
  into {hang, token-overbudget, wall-clock-within-budget}; only the first two are claimed as
  harness properties. The harness-attributable driver of wall-clock exhaustion is *loop shape*
  (round trips per cell, tokens per iteration) and is reported per harness.
- **Budgets:** `wall_timeout_s` is re-fit per (model, host) as k× that model's median finished-run
  wall time on the T0 floor (k frozen before the battery; k=5 unless amended), keeping the token
  budget as the host-independent primary cap. Wall-clock Goodput is labeled host-conditional.
  *Frozen (2026-07-03, `fit-timeouts.js` → `timeout-fits.json`, applied by `matrix.sh` as a
  model-conditioned FLOOR — `effective_wt = max(task wt, fit)`):* `deepseek-r1:1.5b` 300s ·
  `qwen3:8b` 360s · `deepseek-r1:8b` 390s. Models without T0 ledger data (all qwen3.5 variants)
  are **UNFIT** and must run a T0 calibration slice before entering the scaled battery.

### 5A.2 H3b re-mechanized: inline-vs-out-of-band reasoning, de-confounded on qwen3.5
Live probes: `qwen3.5:9b` (and `qwen3:8b` on the same stack) return reasoning in a **separate
field** on both the native and `/v1` endpoints — the content channel stays clean in both think
modes; the pinned `deepseek-r1` templates emit `<think>` inline in content. New design:
1. **Same-weights thinking toggle** (`qwen3.5:9b` think on/off; also 2b/4b): isolates thinking
   *overhead* (latency/tokens) from capability at fixed weights. Prediction: parse-and-apply
   harnesses (`pi`/`goose`) do **not** collapse in either mode (content stays clean); wall-clock
   cost rises with think on.
2. **Inline-narration arm**: the pinned `deepseek-r1` digests (NOT re-pulled — the frozen ledger
   depends on them) remain the inline-reasoning probes. Optionally, a re-pull of the same weights
   under a fresh tag (new template with separated thinking) gives a **same-weights serving-layer
   contrast**: inline vs out-of-band on identical weights — the cleanest possible H3b test; both
   digests pinned in `ENV.md`.
3. `hermes` is excluded from H3b evidence (transport artifact, §3 H3b status); its deepseek cells
   are re-run only after the context-window/`/v1` redirect fault is fixed and are reported under H1.

### 5A.3 H3a gains a local bookend: codex @ qwen3.5:9b
`qwen3.5:9b` emits well-formed OpenAI-style structured tool calls (probe 2026-07-02). Pre-registered
prediction: `codex` — 0/77 on all prior local models — scores **>0 on `qwen3.5:9b`**, reproducing
the interface-fit discontinuity *entirely locally* (no cloud/scale/home-turf confound). Refuted if
codex stays ~0 there while `pi`/`hermes`/`goose` (same protocol class) recover — that would mean
codex's zero is not (only) protocol availability. Either outcome is reported. The cloud bookend
(gpt-5.5) is retained but relabeled "native-provider demonstration" (co-tuning confound noted).

### 5A.4 Statistics tightened (applies to every §5.4 comparison)
- All paired comparisons use a **task-clustered bootstrap** (resample tasks, then seeds within
  task); per-run pooling is reported only as a sensitivity check.
- H2's rank-stability claim requires a **noise null**: observed cross-model rank instability
  (Kendall's τ between model columns) must exceed the 95th percentile of a null built by
  seed-resampling within model columns; "the ordering changes" alone is not evidence.
- H1's spread is computed **among interface-compatible pairs** (protocol-handshake passes);
  structural zeros of the H3a class are excluded from H1 so one phenomenon is not counted twice.

### 5A.5 Model panel (supersedes §5.1's local list)
Spine: **qwen3.5 ladder** `2b`/`4b`/`9b`, each ± thinking (same weights) — within-family,
within-generation size sweep on 16GB hardware. Anchors: `qwen3:8b` (cross-generation link to the
frozen pilot), pinned `deepseek-r1:1.5b`/`8b` (inline-narration arm; Llama- and Qwen-distill
respectively, giving within-family shape contrasts). Cloud: unchanged (§5.1 clause on ≥2 families).
`qwen3:14b` is dropped (marginal on 16GB; superseded by the 9B new-generation point — the axis it
served is relabeled capability-per-GB, not size).

### 5A.6 T1 tier expanded to 3 tasks, all proof-carrying (H5 prerequisite; added 2026-07-03)
Tier-level claims (H5) need ≥3 tasks per tier. T1 now comprises `tool-recover` (two-phase
generator, **hardened**: random nonce + sha256(nonce+cases) proof-of-execution — hand-writing
the fixture no longer passes, closing the results-§6.3 bypass), `tool-recover-lock`
(stale-lock deletion recovery), and `tool-recover-config` (config-from-error recovery) — three
distinct recovery shapes, each emitting an artifact whose validity requires code execution.
Reference-solution and hand-written-artifact-rejection paths are CI-tested
(`crucible/test/t1-tasks.test.js`). Pilot comparability note: the pilot ran pre-hardening
`tool-recover`; its weak local models never used the hand-write bypass, so pilot T1 numbers
remain interpretable; cross-battery T1 comparisons cite the version.

## 6. Threats to validity (carried from the datasheet)

Homegrown battery (mitigated by the external anchor); narrow panel + shape×family confound (H3b);
1-seed cloud slice power; metering blind spots (`codex`/`openclaw`; subscription `gpt-5.5`; Claude
cache-inflated cost); hardware-conditional latency; deterministic Path/State proxies unvalidated
against humans; few seeds → wide CIs (honestly reported, not hidden).

## 7. Non-claims (explicit)

Not a model leaderboard; not a complete/definitive benchmark; not a broad cross-family reach proof
(2 local families); latency is this host's; the pilot is exploratory and its in-sample support is
motivation, not confirmation. The confirmatory claims are exactly those the §5 design pre-registers.
