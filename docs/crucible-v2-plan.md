# Crucible v2 — Research plan: personalized task benchmarks that pay for themselves

> Written 2026-09-17. A plan for turning the existing harness-measurement apparatus into a
> study of the question the idea actually poses: *is it worth building a benchmark for your own
> task, and does it pick a cheaper (model, harness) than the alternatives?* Companion to
> [`crucible-hypotheses.md`](./crucible-hypotheses.md) (v1 pre-registration) and
> [`crucible-related-work.md`](./crucible-related-work.md) (v1 positioning). Nothing here
> supersedes the frozen v1 ledgers or claims.

---

## 0. Where things actually stand (honest inventory)

### What exists (v1 — "measure the harness, not the model")

| Asset | State | Reusable for v2 as |
|---|---|---|
| `loop.sh` + 9 adapters + `matrix.sh` + token proxy + `finalize.js` + `report.js` | mature, ~1,800 frozen runs across pilot (515), qwen3.5 arms, size ladder (222), cloud bookends, Phase D (341), Terminal-Bench anchor (370) | **the sweep engine** — factorial config × seed with metered cost, timeouts→Goodput, clustered bootstrap CIs, CI drift guard |
| Task contract (`TASK.md` + hidden `verify.sh` + `task.yaml`) + `import-task.js` | stable; deterministic oracles only, by design (SPEC §2 "no LLM-as-judge in the scored path") | the **target format** the task synthesizer must emit |
| `loops/01-grading-loop` (grade schema, `verify-grade.sh` cross-field rule, confidence gate, review queue) + `loops/03-self-improving` (`record-override.sh`, `agreement.sh`, managed calibration block) | working, offline-testable | the **judge-calibration loop**: it already tracks machine-vs-human agreement and turns overrides into precedent |
| `tasks/research-deck`, `tasks/self-improving-rubric` | rules-only gates for knowledge-work artifacts | prototypes of what rules *can* cover (structure, coverage, sourcing) and what they can't (quality) |
| `pricing.json` + `cost.js` | prices ledgers from metered tokens | the cost model — must be extended with human time + construction calls |
| Paper draft (`paper/main.tex`, 8pp) + `SPRINT.md` | targeted NeurIPS 2026 workshops; **both target deadlines (Aug 29 SLM-Agents, Sep 5 JUDGe) have passed and the paper was not submitted anywhere** (confirmed 2026-09-17); `main.tex` untouched since Jul 20 | see §6 — decide its fate, don't let it block v2 |

### What does *not* exist (and the idea requires)

1. **Task synthesis from user examples.** Every task in the battery is hand-authored. There is no "description + 2–5 examples → TASK.md + verify.sh + rubric" path.
2. **A hybrid verifier.** The spec forbids LLM judges in the scored path. v2 needs a judge for quality dimensions — with its agreement to human grades measured and reported, not hidden.
3. **Personalization.** Tasks are universal; there is no user, no golden set, no per-user recommendation.
4. **Construction-cost accounting.** Cost is per-run only. Nothing counts the cost of *building* the benchmark (human grading minutes, synthesis calls, the sweep itself) or computes break-even.

The v1 apparatus is the right *substrate* for v2 (it makes "config X beats config Y at cost Z" credible), and the v1 findings are the right *motivation* (tier-specific winners; pi@2b > thin@9b; codex 0/144 local vs 20/20 cloud; quality compresses at the frontier so cost discriminates). But v2 is a new study, not an extension of the paper.

---

## 1. Positioning corrections (state these in the writeup, don't get caught by a reviewer)

Two claims in the repo overreach and one is now stale:

- **"Routers route on prompt difficulty / prompt length."** RouteLLM learns from *preference data*; Hybrid LLM from quality-gap; MetaRouter from per-user pairwise preferences via a contextual bandit. The defensible statement is: *existing routers condition on the query (and, in MetaRouter, on a user's revealed preference), not on an executable task specification derived from the user's own examples, and none route over (model, harness) pairs.* The pre-registered "difficulty-router contrast" (H5) should use an actual open router as the baseline, not prompt length.
- **"Factorial harness × model with a multiplicative safety gate is our contribution."** Harness-Bench (2605.27922) already does both across 106 tasks; `RATIONALE.md` rows 3 and 7 cite it as the source. v1's real differentiators are narrower: sub-frontier *local* models as discriminating probes, the interface-fit mechanism (codex bookend, dialect chain), Goodput's timeout correction, and cross-model rank stability. Say that.
- **Three 2026 papers now sit directly on the v2 idea** and must be positioned against, not around:

| Paper | What it already does | What it leaves open (v2's room) |
|---|---|---|
| **Personalized Benchmarking** — Garbacea, Wang, Tan, Findings of ACL 2026 ([2604.18943](https://arxiv.org/abs/2604.18943)) | Per-user Elo/Bradley-Terry over 115 Arena users; BT correlation with aggregate ρ≈0.04, 57% of users near-zero or negative; topic+style features predict per-user rankings | preference votes, not executable outcomes; no task definition, no cost, no harness axis, no "should you bother" |
| **MetaRouter** — Zeng et al., Jun 2026 ([2606.06178](https://arxiv.org/abs/2606.06178)) | learns a user's cost–performance preference from few pairwise comparisons; meta-learned bandit; routes models per query | routes on *preference*, not on verified task success; no user-defined task/evaluator; no construction cost; models only |
| **Agent-as-a-Router** — Jun 2026 ([2606.22902](https://arxiv.org/abs/2606.22902)) | execution-grounded routing for coding tasks over 8 frontier LLMs; CodeRouterBench (~10K instances); regret-based comparison | generic tasks, not the user's; models only, no harness; no benchmark-construction cost or break-even |
| **EvalGen** — Shankar et al., UIST 2024 ([2404.12272](https://arxiv.org/abs/2404.12272)) | user grades a subset → selects code assertions / LLM graders aligned to the user; documents *criteria drift* | evaluation only — never closes the loop to *selection*; no cost accounting; no harness/model sweep |
| **Harness-Bench** — Yao et al., 2026 ([2605.27922](https://arxiv.org/abs/2605.27922)) | model × harness under shared tasks/budgets, security gate, process scoring | fixed public tasks; no per-user construction; no recommendation |

Also worth a sentence each: HAL (cost-aware agent leaderboard, model-first), AdaRubric / rubric-generation work (task-adaptive rubrics for agent eval — adjacent to the synthesizer), LLMRouterBench / RouterBench (router benchmarks on public data).

**The gap nobody occupies:** *the economics of the decision itself.* No paper reports the cost of constructing a task-specific evaluator, measures its agreement with the user, uses it to select over (model, harness) pairs, and computes after how many repetitions the construction pays off versus just using the frontier model. That is v2's wedge, and it follows from the premise: if intelligence is expensive, so is deciding which intelligence to use.

---

## 2. The research question, sharpened

> **Given a recurring task specified by a handful of a user's own examples, can an automatically constructed task-specific evaluator (deterministic rules + a judge calibrated to the user) select a (model, harness) configuration that meets the user's quality bar at lower cost than always-frontier, a generic-leaderboard pick, or a query-level router — and after how many repetitions of the task does the cost of building and running the benchmark pay for itself?**

Three falsifiable hypotheses, each with a refutation condition (same discipline as `crucible-hypotheses.md` §3):

### H-A — Evaluator validity from few examples
- **Claim.** A hybrid evaluator synthesized from a task description + k∈{2,3,5} golden examples, then calibrated on ~20 user-graded outputs, agrees with the user's held-out grades at Cohen's κ ≥ 0.6 (substantial), and hybrid > judge-only > rules-only on the quality dimensions.
- **Refuted if** κ < 0.4 on most tasks, or agreement does not improve from k=2 to k=5, or calibration on the golden set does not raise κ over an uncalibrated judge.
- **At-risk regressions.** Criteria drift (EvalGen): users revise criteria after seeing outputs — measure it by re-asking users to grade the golden set at the end. Judge self-preference: the judge model favors outputs from its own family — test by rotating the judge across two families and reporting the delta.

### H-B — Selection value over baselines
- **Claim.** The config the personalized benchmark recommends has lower cost at the user's quality bar than (a) always-frontier, (b) the top of a generic leaderboard, (c) an open router (RouteLLM-style, run on the task prompt), and (d) cheapest-config; and its regret vs. the oracle-best config on held-out repetitions is small (< 0.1 Goodput).
- **Refuted if** the frontier default is on the Pareto frontier for most tasks (nothing cheaper clears the bar), or the generic pick / router matches the personalized pick's cost at the bar — i.e., personalization buys nothing.
- **Why this could be true (from v1).** The winner was tier-specific (pi@qwen3:8b for tool-recovery, aider@deepseek-r1:8b for multi-file); the same 2b model went 0.24→0.79 with a harness swap; at the frontier quality compressed and cost differed 6×. A generic rank cannot see any of that.

### H-C — Break-even
- **Claim.** With total cost = C_construct (user grading minutes × wage + synthesis + calibration calls) + C_sweep (all configs × seeds, metered) + N × c_selected, the break-even N* against always-frontier is below the task's realistic recurrence for most tasks (e.g., N* < 52 for a weekly task).
- **Refuted if** the median N* exceeds a year of recurrence, or N* is dominated by C_sweep such that the sweep must be truncated below what H-B needs.
- **Report** N* as a distribution across tasks with sensitivity to the wage assumption and to the number of configs swept; also the *marginal* break-even of adding one more config.

**Non-claims.** Not a router paper (we do one-time selection per recurring task, not per-query dispatch). Not a judge-quality paper (the judge is a component whose noise we make visible). Not a model leaderboard.

---

## 3. What to build (minimal, on top of v1)

Each item names the v1 file it extends. Keep the SPEC conformance rules; add to them.

1. **`crucible/synth/` — task synthesizer.**
   Input: `task-spec.yaml` (plain-language description, 2–5 golden outputs, optional inputs, quality bar). Output: a Crucible task dir — `TASK.md`, `verify.sh` (deterministic: structure, schema, coverage, citations, length, forbidden content — reuse the `research-deck` and `verify-grade.sh` idioms), `rubric.md` (judge criteria, 3-level `pass/partial/fail` per criterion as in `loops/01`), `task.yaml` with `oracle.type: hybrid`. Emit via the `import-task.js` `emitTask()` pattern. Log every synthesis call's tokens → `C_construct`.
2. **Hybrid scoring — extend `lib/score.js` / `finalize.js`.**
   `Completion = rules_pass × judge_score`; rules gate first (a structurally invalid artifact scores 0 regardless of prose quality), judge only on the residual. The run record gains `judge: {model, score, confidence, kappa_task, ci}`. The scorecard prints judge agreement as a first-class column next to Goodput — this honors SPEC §2's "never a silent judge" while allowing one. Judge model fixed per battery and recorded in `ENV.md`.
3. **Golden-set protocol — extend `loops/01` + `loops/03`.**
   Per task: (i) user supplies k golden examples; (ii) synthesizer emits evaluator; (iii) we generate ~20 outputs from a *mix* of configs (never one family — avoids calibrating the judge to frontier prose); (iv) user grades them in the `loops/01` grade schema (~15–30 min); (v) split 10 calibration / 10 held-out; (vi) `agreement.sh` reports κ on held-out; corrections feed the calibration block (`loops/03`). Time each grading session → human component of `C_construct`.
4. **Recommender — new `crucible/recommend.js` reading a ledger.**
   Per task: Pareto over (Goodput, $/run, wall) subject to the user's quality bar; output the recommendation sentence with CIs ("aider@qwen3.5:9b at $0.00/run, Goodput 0.81 [0.72, 0.88] vs claude-code 0.94 at $1.38") plus the four baselines' picks and their cost at the bar. Regret vs. oracle on held-out seeds.
5. **Break-even — extend `cost.js`.**
   `N* = (C_construct + C_sweep) / (c_default − c_selected)` with the quality constraint; sensitivity table over wage ∈ {$20, $50, $150}/h and over sweep size.
6. **Baselines (real, not straw).** (a) Claude Code / frontier default; (b) generic-leaderboard pick — top of Aider polyglot for coding tasks, LMArena or HAL for knowledge work, whichever config we can actually run; (c) an open router — RouteLLM's released router pointed at the same strong/weak pair; (d) cheapest config that runs. Pin all four picks in `audit-claims.js`.

Everything stays deterministic-and-drift-guarded: the ledger is frozen, `report.js` regenerates, `audit-claims.js` pins the numbers, CI fails on drift. That machinery is v1's most reusable asset and it is rare in this literature — keep it visible in the paper.

---

## 4. Study design

**Tasks (unit of analysis — power comes from tasks, not users).** Target 15–20 recurring tasks across ≥3 domains, sourced from real users, each with 2–5 golden examples and ~20 graded outputs. Candidate pool from 100x Engineers' own operations: weekly research brief, cohort-assignment grading (the `loops/01` rubric is already one), lecture-deck generation, changelog / release notes, support-email triage and drafting, SQL/analytics report, data-cleaning scripts, doc summarization, code review comments, migration PRs. Aim for a split like 8 coding / 8 knowledge-work / 4 mixed so the rules-vs-judge contrast is testable per domain.

**Users.** 6–10 people, each owning 2–3 tasks. **Recruitment from the 100x cohort under consent is confirmed feasible (2026-09-17).** Get written consent, keep golden sets private (they contain real work product), report only aggregates. State this in the datasheet. Recruit in Phase 2 so users are ready when Phase 3 opens; the consent form and the grading UI (the `loops/01` review-queue flow) are Phase 2 deliverables.

**Configurations.** Keep it small enough to afford 5 seeds. From the v1 panel: harnesses {ollama-thin, pi, aider, hermes, claude-code, codex} × models {qwen3.5:9b, llama3.2:3b, gpt-4o-mini, gpt-5.5, claude-sonnet, claude-haiku, claude-opus} restricted to pairs that are interface-compatible (v1 already knows which — codex@local is a structural zero; don't spend seeds on it). ~10–12 configs per task.

**Seeds.** 5 per (task, config) — v1's pre-registered minimum. ~15 tasks × 11 configs × 5 seeds ≈ 825 cells + calibration outputs. Local cells are $0 but ~hours; cloud cells metered. Budget the cloud spend before Phase 2 and cap it in the pre-registration.

**Judge.** One fixed judge model per battery (a mid-cost model, not the frontier default, so the judge is not also a contestant); rotate to a second family on a 3-task subset to measure self-preference.

**Analysis plan (pre-register before Phase 3).**
- H-A: κ per (task, evaluator type, k) with bootstrap CI; paired comparison hybrid vs. rules-only vs. judge-only; drift test on the golden set.
- H-B: per task, the recommended config's cost at bar vs. each baseline; task-clustered bootstrap on the paired cost difference; regret vs. oracle on held-out seeds.
- H-C: N* per task; median and IQR; sensitivity grid.
- Everything regenerates from a frozen ledger; every number in the paper pinned.

---

## 5. Phases, gates, and a realistic clock

| Phase | Weeks | Do | Go/no-go gate |
|---|---|---|---|
| **0 — Decide the v1 paper** | 1 | Pick §6 option; if arXiv, post it (it becomes citable motivation for v2) | decision recorded in `SPRINT.md` |
| **1 — Evaluator pilot** | 3 | Build `synth/` + hybrid scoring; run on 3 of *your own* tasks (research brief, grading, deck); you are user #1; measure κ | **hybrid κ ≥ 0.6 on ≥ 2/3 tasks.** If not, the judge is too noisy for selection — stop and write the negative result as a short paper (JUDGe-style venues take it) |
| **2 — Sweep + recommender** | 4 | 10+ tasks × ~11 configs × 5 seeds; `recommend.js`; four baselines; break-even calc | recommender beats ≥ 2 baselines on cost-at-bar on a majority of tasks |
| **3 — External users** | 3 | Recruit 6–10 users, 15–20 tasks total; **pre-register** H-A/B/C thresholds and the config list before running; held-out grading; drift re-grade | ledger frozen, claims pinned |
| **4 — Write** | 3 | paper + datasheet + release | — |

≈ 14 weeks → early January 2027. Realistic targets given that: **COLM 2027** (~March), **NeurIPS 2027 Datasets & Benchmarks** (~May), or **TMLR** at any point. ICLR 2027 main is not realistic for v2.

---

## 6. What to do with the v1 paper (decide in Phase 0, one week, then move on)

The workshop deadlines in `SPRINT.md` are gone and the paper was never submitted, so there is no pending review to wait on. Three options, in order of my recommendation:

1. **arXiv it now as-is** (non-anonymous, sole author, cs.SE). It is a competent apparatus-plus-measurement study; on arXiv it becomes a citable "why generic rankings can't answer this" foundation for v2, and the frozen ledgers become a public artifact. Cost: ~2 days (S1.3–S1.5 in `SPRINT.md` are still the checklist). Then submit to an **ICLR 2027 workshop** (~Feb 2027) with the positioning fixes from §1.
2. **TMLR** (rolling, archival). Rewards rigor over scale, but reviewers will press hard on Harness-Bench overlap and the 10-task anchor; expect a revise cycle that competes with v2 for your time.
3. **Fold it into v2** as §2 (motivation) and never publish it standalone. Cleanest single story, but you lose a year of citation and the ledgers stay unpublished until 2027.

Whatever you pick, rewrite `crucible-related-work.md` §1 and §2.3 and the paper's "Routing" paragraph per §1 above before anyone else reads them.

---

## 7. Risks and how the design absorbs them

- **Judge noise on knowledge work is the whole game.** The Phase 1 gate exists for this. If κ is low, the honest paper is "few-shot evaluators aren't yet trustworthy enough to route on" — still a contribution, and a cheaper one.
- **Goodhart against the evaluator.** The sweep optimizes for the synthesized evaluator; the final H-B claim must be scored on *user-graded held-out outputs*, not on the evaluator. Keep the held-out 10 untouched until Phase 3 analysis.
- **Judge self-preference.** Fixed non-contestant judge + two-family rotation on a subset; report the delta.
- **Small user n → treat tasks as the unit** and cluster by user in the bootstrap; say so.
- **Break-even is wage-sensitive.** Report the sensitivity grid; never a single N*.
- **Cloud cost.** Cap it in the pre-registration; the v1 metering proxy makes the cap enforceable per cell.
- **Privacy.** Golden sets are real work product; consent + aggregate-only reporting + a datasheet clause.
- **Scope creep back into harness science.** v1 already answered "does the harness matter" well enough. v2 asks a different question; resist adding more harnesses or models beyond what H-B needs.

---

## 8. Contribution statement (draft — three bullets, each with its evidence)

1. **A method** for constructing a task-specific hybrid evaluator from a plain-language description and 2–5 golden examples, calibrated on ~20 user grades, with judge–human agreement reported as a first-class metric (H-A).
2. **A measurement** that selecting a (model, harness) configuration against that evaluator beats always-frontier, a generic-leaderboard pick, and a query-level router on cost at the user's quality bar, across N recurring tasks from M users (H-B).
3. **An accounting** of the full cost of deciding — construction, calibration, sweep — yielding the break-even repetition count at which a personal benchmark pays for itself, with its sensitivity (H-C).

Title candidates: *"Is This Task Worth a Benchmark? Few-Example Evaluators for Cost-Aware Model–Harness Selection"* · *"Personal Benchmarks That Pay for Themselves"* · *"Deciding Which Intelligence to Use: The Economics of Task-Specific Evaluation."*

---

## 9. Key commands (once built)

```bash
node crucible/synth/synth.js --spec tasks/user/weekly-brief/task-spec.yaml   # emit task dir
CRUCIBLE=1 JUDGE=… ./loop.sh tasks/user/weekly-brief pi 5                     # one hybrid-scored run
bash crucible/matrix.sh                                                       # the sweep (as v1)
node crucible/recommend.js crucible/results/v2.jsonl --task weekly-brief      # the recommendation
node cost.js --ledger crucible/results/v2.jsonl --breakeven --wage 50         # N* per task
node crucible/audit-claims.js                                                 # drift guard
```
