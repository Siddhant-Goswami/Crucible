# Crucible — Related Work & Positioning

> This is the "why is this new, and how does it sit against the field" document a reviewer will
> demand. It positions Crucible against the real, verifiable literature (URLs below), states the
> defensible novelty, answers the two "isn't this just X?" objections head-on, and lists the
> citations the writeup must carry. Companion to [`crucible-results.md`](./crucible-results.md)
> (findings) and [`harness-first-principles.md`](./harness-first-principles.md) (the P1–P9 backbone).

## 1. Where Crucible sits in one sentence

Crucible is **harness-first, transfer-tested, safety-gated, deterministically-scored** agent
evaluation whose output is a **local-vs-cloud routing signal keyed on task-tool-capability** — a
combination no single prior system provides. The field has, separately: benchmarks that *conflate*
model and harness; one leaderboard that measures agents cost- and process-aware but *model-first*;
one arena that *decomposes* the agent but scores it subjectively; and a routing literature that
routes on *prompt difficulty* rather than *task/tool requirements*. Crucible's wedge is the
intersection.

## 2. The landscape (real, verifiable)

### 2.1 Agent/coding benchmarks — and whether they isolate the harness

| Benchmark | What it scores | Isolates harness? | Relationship to Crucible |
|---|---|---|---|
| **SWE-bench / Verified** ([2310.06770](https://arxiv.org/abs/2310.06770), [Verified](https://openai.com/index/introducing-swe-bench-verified/)) | resolve real GitHub issues, test-checked | **No** — scores model+scaffold jointly | The *problem statement* Crucible is built on (OpenAI notes scaffold moves the score 10–20 pts). Crucible makes the scaffold the axis. |
| **SWE-agent / ACI** ([2405.15793](https://arxiv.org/abs/2405.15793)) | agent-computer interface unlocks SWE-bench | Demonstrates it, doesn't *measure* it | **Closest conceptual ancestor.** Crucible turns its qualitative "the interface is first-class" into a quantified factorial metric. |
| **Aider polyglot** ([leaderboard](https://aider.chat/docs/leaderboards/)) | 225 Exercism edits; edit-format compliance | Inverse — fixes the harness, varies the model | Complementary; Aider is one of Crucible's adapters. |
| **Terminal-Bench** ([tbench.ai](https://www.tbench.ai/leaderboard)) | end-to-end terminal tasks | No | Candidate external task source (§4). |
| **τ-bench / τ²-bench** ([2406.12045](https://arxiv.org/abs/2406.12045), [tau2](https://github.com/sierra-research/tau2-bench)) | tool-agent-user under a policy; origin of **pass^k** | No (fixed harness) | Overlaps on *policy-following process eval* + reliability-over-repeats; Crucible attributes pass^k-style stability to the *harness* and scores Path/State deterministically. |
| **GAIA** ([2311.12983](https://arxiv.org/abs/2311.12983)), **WebArena** ([webarena.dev](https://webarena.dev/)), **AgentBench** ([2308.03688](https://arxiv.org/abs/2308.03688)), **OSWorld** ([2404.07972](https://arxiv.org/abs/2404.07972)) | long-horizon/tool/web/OS agents | No | Motivate "harness capacity"; some (OSWorld, WebArena) are ancestors of Crucible's deterministic-oracle stance. |
| **BFCL / Gorilla** ([leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html)) | function/tool-call correctness | No (ranks models) | Measures the tool-calling *capability* Crucible's tool-calling adapters presuppose (see §6.4 in results). |
| **MLE-bench** ([2410.07095](https://arxiv.org/abs/2410.07095)) | Kaggle ML-eng; compared AIDE/MLAB/OpenHands scaffolds | **Partially** (ad hoc scaffold swap) | Crucible generalizes the ad-hoc scaffold comparison into a protocol with a transfer test + safety gate. |
| **Cybench** ([2408.08926](https://arxiv.org/abs/2408.08926)) | CTF with subtask milestones | No | Milestone structure parallels Crucible's Path/checkpoint scoring. |

### 2.2 "Scaffold vs model" analyses (the thesis is known; the *method* is the gap)

- **METR — time-horizon & model evals** ([2503.14499](https://arxiv.org/abs/2503.14499), [o1-preview report](https://metr.org/evaluations/openai-o1-preview-report/)): a scaffold *adapted to the model* roughly doubles weak-model success — direct empirical backing for Crucible's P8 (use mid/local models as probes). METR measures capability *through* a fixed elicitation; Crucible measures the elicitation.
- **Epoch AI — "Why benchmarking is hard"** ([epoch.ai](https://epoch.ai/gradient-updates/why-benchmarking-is-hard)): scaffold swaps move frontier SWE-bench by ~11–20%; a low score may be "a scaffolding bottleneck." Quotable motivation; Crucible operationalizes the warning.
- **"AI Agents That Matter"** ([2407.01502](https://arxiv.org/abs/2407.01502)): agent evals must be **cost-controlled**; simple baselines beat complex agents once cost is counted. Direct parent of Crucible's *cost-reported-alongside, fixed-budget, ≥3-seed* stance; our "lean harness can win" restates their result in the harness dimension.

### 2.3 Routing / cascades (adjacent — they route on the wrong signal for agents)

| System | Routes on | Gap Crucible fills |
|---|---|---|
| **RouteLLM** ([2406.18665](https://arxiv.org/abs/2406.18665)) | predicted prompt difficulty (strong vs weak model) | single-turn, trivial harness — no task/tool dimension |
| **FrugalGPT** ([2305.05176](https://arxiv.org/abs/2305.05176)) | cascade + prompt adaptation | QA-level, non-agentic |
| **Hybrid LLM** ([2404.14618](https://arxiv.org/abs/2404.14618)) | per-query edge/cloud quality-gap | **most on-point for local-vs-cloud**, but routes on quality-gap, not tool/capability tier |
| **RouterBench** ([2403.12031](https://arxiv.org/abs/2403.12031)) | a benchmark *for routers* | analogue one layer up; none route on harness/tool requirements |

**Common thread:** all route on predicted per-prompt difficulty or quality-gap; **none route on
harness capability or task-tool requirements.** Crucible's §4 routing table is exactly that missing
signal (e.g. "T1 tool-recovery on an 8B local model → escalate to cloud", independent of prompt
length).

### 2.4 Safety & trajectory evaluation

- **AgentHarm** ([2410.09024](https://arxiv.org/abs/2410.09024)), **ToolEmu** ([2309.15817](https://arxiv.org/abs/2309.15817)), **AgentDojo** ([2406.13352](https://arxiv.org/abs/2406.13352)), **InjecAgent** ([2403.02691](https://arxiv.org/abs/2403.02691)): reference agent-safety / prompt-injection benchmarks. They score model refusal/robustness on a *fixed* harness (ToolEmu uses an LM judge); Crucible's T4 tier instead checks whether the *harness* contains the blast radius over the trajectory with *deterministic* policy checks (right-tool-wrong-resource). Crucible should cite these and can borrow their attack patterns for T4.

### 2.5 Reproducibility & variance

- **"Adding Error Bars to Evals"** ([2411.00640](https://arxiv.org/abs/2411.00640)): clustered SEs, paired differences, power analysis. The methodological backbone Crucible's mean±bootstrap-CI + paired-bootstrap significance should cite explicitly.
- **pass^k** (τ-bench): reliability over repeats — the family Crucible's seed-variance + goodput design belongs to (see §5).

## 3. The two objections a reviewer will raise — and the answers

### 3.1 "Isn't this just the Holistic Agent Leaderboard (HAL)?"
**HAL** ([2510.11977](https://arxiv.org/abs/2510.11977), [hal.cs.princeton.edu](https://hal.cs.princeton.edu/)) is the strongest prior system and the single biggest novelty threat: it already delivers **cost-aware, reproducible, process-level** agent evaluation across 11 benchmarks with automated log analysis, and even reports that two scaffolds on the same model disagree on ~31% of tasks.

**The honest answer (must be in the paper):** HAL is **model-first and descriptive** — it ranks agents and *observes* scaffold disagreement. Crucible is **harness-first and inferential**: (a) a **factorial harness×model** design that makes "which harness" the dependent variable, (b) a **cross-model reach/transfer metric** (does the harness *ordering* survive a model swap?) that HAL does not compute, (c) a **multiplicative safety gate** (`Score = Safety × …`) that HAL's additive/parallel dashboards don't enforce, and (d) **deterministic** Path/State trace-scoring rather than LLM log-analysis. Crucible is, in effect, "HAL made harness-first, with a transfer test and a safety gate."

### 3.2 "Isn't this just Agent Arena?"
**Agent Arena** ([arena.ai](https://arena.ai/blog/agent-arena/), [Berkeley/Gorilla](https://gorilla.cs.berkeley.edu/blogs/14_agent_arena.html)) already decomposes an agent into **model × framework × tools** and ranks each component — the closest thing to Crucible's decomposition idea.

**The answer:** Agent Arena ranks by **subjective human ELO on open-ended tasks**. Crucible uses **deterministic oracles, fixed token/iteration budgets, a safety gate, and a cross-model transfer test** — a controlled experiment, not a preference vote. Different epistemology (hard-to-vary causal attribution vs. crowd preference).

## 4. Honest limitations / threats to validity (state them, don't hide them — P5)

1. **Homegrown task battery.** 9 small tasks (T0 fizzbuzz … T4 injection), not a recognized suite. *Mitigation on the roadmap:* anchor a slice to SWE-bench-Verified / Terminal-Bench / τ²-bench so results are comparable (Crucible's task contract — `TASK.md` + deterministic `verify.sh` + hidden `checkpoints.sh` — is designed to wrap external tasks; the importer is the next build).
2. **Construct validity of Path/State.** These are *deterministic proxies* for genuinely fuzzy process quality; they have not been validated against human judgment. *Mitigation:* label a sample of traces and report proxy↔human agreement before claiming Path/State measure what they name.
3. **Model panel is narrow.** 3 local models in 2 families (deepseek-r1 ×2, qwen3) + one cloud reference. The reach/transfer claim needs ≥3 families and ≥2 cloud models to be robust.
4. **Metering blind spots.** `codex`/`openclaw` bypass the token proxy (read 0/`—`); Claude cost is a cache-inflated upper bound + a ~22k/call system-prompt tax; local marginal $ is 0 (latency is the real cost). All flagged in-scorecard, none hidden.
5. **Hardware-conditional latency.** Local latency is this host's (see `ENV.md`), not a datacenter's — a routing input to re-measure per deployment.
6. **Few seeds.** 3 seeds → wide CIs; most pairwise differences are correctly reported *not significant*. Adopting pass^k and power analysis ([2411.00640](https://arxiv.org/abs/2411.00640)) is on the roadmap.

## 5. Citations the writeup must carry

**Must-cite (position against directly):**
1. HAL — Holistic Agent Leaderboard — [2510.11977](https://arxiv.org/abs/2510.11977)
2. "AI Agents That Matter" (Kapoor, Narayanan et al.) — [2407.01502](https://arxiv.org/abs/2407.01502)
3. SWE-agent / Agent-Computer Interface — [2405.15793](https://arxiv.org/abs/2405.15793)
4. "Adding Error Bars to Evals" (Anthropic) — [2411.00640](https://arxiv.org/abs/2411.00640)
5. A routing anchor — Hybrid LLM [2404.14618](https://arxiv.org/abs/2404.14618) and/or RouteLLM [2406.18665](https://arxiv.org/abs/2406.18665)

**Strongly advisable:** SWE-bench Verified, τ-bench ([2406.12045](https://arxiv.org/abs/2406.12045), pass^k), Epoch "Why benchmarking is hard", METR time-horizon ([2503.14499](https://arxiv.org/abs/2503.14499)), Agent Arena, AgentDojo ([2406.13352](https://arxiv.org/abs/2406.13352)) / AgentHarm ([2410.09024](https://arxiv.org/abs/2410.09024)).

> **Provenance note.** The P1–P9 backbone in `harness-first-principles.md` synthesizes seven 2026
> harness-engineering papers (Harness-Bench 2605.27922, AHE 2604.25850, VeRO 2602.22480, HarnessAudit
> 2605.14271, NLAH 2603.25723, Code-as-Agent-Harness 2605.18747, RUCAIBox survey). These were
> independently verified to exist (arxiv + HuggingFace Papers + author-matching GitHub repos +
> project sites), but they postdate common training cutoffs — **verify each DOI resolves before
> camera-ready.** They ground the *concepts*; the works in §5 above ground the *positioning*, and a
> submission needs both.
