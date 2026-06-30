# Agent Harnesses — A First-Principles Explanation (through David Deutsch's epistemology)

> Synthesis of seven 2026 sources: the RUCAIBox survey *Agent Systems with Harness
> Engineering* (Tang et al.); *Code as Agent Harness* (Ning et al., 2605.18747);
> *Agentic Harness Engineering / AHE* (Lin et al., 2604.25850); *VeRO* (2602.22480);
> *Auditing Agent Harness Safety / HarnessAudit* (2605.14271); *Natural-Language Agent
> Harnesses / NLAH* (2603.25723); *Harness-Bench* (2605.27922).
> The purpose of this document is conceptual clarity before designing a benchmark.

---

## 0. The lens: what "a good explanation" is

David Deutsch's epistemology gives us the tools to think about harnesses rigorously,
because evaluating a harness is itself an act of knowledge-creation. Five load-bearing ideas:

1. **Knowledge grows by conjecture and criticism, not by induction.** You never *derive*
   a theory from data; you guess boldly and then try hard to refute the guess. Surviving
   criticism is the only mark of quality. There are no foundations and no certainty —
   only error-correction (*fallibilism*).

2. **Good explanations are *hard to vary***. A good account is one whose details are so
   tightly constrained by what it explains that you cannot change them and still explain
   the thing. Bad explanations are *easy to vary*: you can swap in any detail and it still
   "fits," which is exactly why they explain nothing.

3. **Reach.** A good explanation, conceived to solve one problem, turns out to solve
   problems far beyond the data that prompted it. Reach is the signature of having captured
   something real rather than something local.

4. **Observation is theory-laden.** There is no "just look at the result." What you measure,
   and what you take it to mean, is already a theory. A number with no explanatory account
   of *why* it occurred is not evidence — it is a Rorschach blot.

5. **Problems are soluble; all failures are failures of knowledge.** When an agent fails,
   the question is never "is the task possible?" but "which piece of missing knowledge —
   in the model, or in the harness — caused this?"

The striking thing is that the harness-engineering literature, written by people who have
probably never read Deutsch, *re-derives this epistemology under empirical pressure*. AHE
makes each harness edit "a falsifiable contract" (conjecture + criticism). The "factual
structure transfers, prose does not" result is a statement about *reach*. HarnessAudit's
"trajectory is the unit of evidence" is "observation is theory-laden" applied to safety.
The survey's "many model failures are really harness failures" is "all failures are
failures of (mis-attributed) knowledge." This convergence is itself a good sign: the same
explanation arrived at from two independent directions is hard to vary.

---

## 1. First principle: what a harness *is*, and why it must exist

**The problem it solves (a clash of two natures).** A language model is a *single-pass,
stateless function*: context in, tokens out, then it forgets. The world is *stateful,
partially observed, and iterative*: it must be acted on over many steps, with feedback,
recovery, and memory. These two natures are mismatched. The survey names this exactly:

> "a structural mismatch between the single-turn generative interface of LLMs and the
> stateful, iterative nature of real-world problem solving."

A harness is the body of knowledge that bridges that mismatch. In Deutsch's terms,
knowledge is *information that, embodied in a suitable physical system, tends to cause
itself to persist*. A harness is precisely that: knowledge about how to act in an
environment, embodied as code, that keeps a fallible generator on a goal across time.

**Agent = Model + Harness.** This is the field's foundational equation (Harness-Bench states
it literally; the survey gives the two-component decomposition). The model is the *reasoning
engine*; the harness is *"the orchestration layer that mediates all interactions between the
model and the external environment"* — tool invocation, context maintenance, state
persistence, execution control. The sharpest one-line statement of the principle:

> "Without a harness, a model remains a passive text generator; only when embedded within a
> properly engineered harness does it become a functional agent." (survey)

**Statefulness is *constructed*, not intrinsic.** The most counter-intuitive first principle,
and the one most worth internalizing:

> "Because a language model performs a single forward pass and terminates, what appears as
> persistent behavior is entirely constructed by the harness, which maintains message history
> and replays it on every invocation." (survey, §3.1)

The agent's apparent memory, persistence, and goal-directedness are *illusions maintained by
the harness*. This is why the harness, not the model, is where statefulness, error-correction,
and governance actually live.

**The boundary is load-bearing.** Where you draw the model/harness line determines what you can
learn. AHE freezes the model and makes the runner, verifier, and tracer *read-only*, so "every
recorded gain [is] attributable to harness edits rather than shortcuts like disabling the
verifier or swapping the model." The boundary is not bookkeeping; it is the precondition for any
hard-to-vary causal claim about the harness.

---

## 2. The key concepts, each as a hard-to-vary explanation

For each concept: the claim, the *hard-to-vary* account of why it is true, and the *easy-to-vary*
mistake it rules out.

### 2.1 The agent loop
**Claim.** The harness wraps the stateless model in a `call → parse → execute → feed-back` loop
and replays accumulated history each turn.
**Hard-to-vary account.** The loop is the minimal machine that converts a memoryless function into
a process with continuity: each iteration's only link to the past is the history the harness chose
to replay. Therefore *whatever the harness drops from that replay does not exist for the agent.*
Continuity is a harness choice, not a model property.
**Rules out.** The folk theory that the model "remembers" or "stays on task." It does neither;
the harness does, on its behalf.

### 2.2 Code as substrate — and natural language as its counterpoint
**Claim.** Code is the privileged medium of the harness because it is *executable, inspectable,
and stateful* (Ning et al.).
**Hard-to-vary account.** These three properties are not a wish-list; each maps to a need the loop
has. *Executable* → model outputs become operations with verifiable outcomes (closes the
error-correction loop). *Inspectable* → intermediate computation becomes structured traces the
harness can read and act on (makes the process legible). *Stateful* → the evolving program *is* the
task progress, persisted across steps (gives the loop somewhere to stand). Remove any one and the
loop degrades in a specific, predictable way.
**Counterpoint (NLAH).** The harness *policy* — "what evidence to preserve, when to delegate, how
to verify, when to stop" — is better expressed as an *editable natural-language object* separated
from mechanism, because policy that hides inside controller code cannot be inspected, compared, or
ablated. So: **mechanism wants to be code (verifiable, deterministic); policy wants to be legible
(NL or declarative), separated from mechanism.** NLAH shrank harness policy by ~95% (60k → 3k
tokens) at comparable task scores — a reach result: the durable content was small and structural;
the rest was incidental glue.

### 2.3 Action and observation interfaces (perception, state representation)
**Claim.** The harness decides *what the model sees* and *how its intentions become actions*.
**Hard-to-vary account.** Perception is a forced trade-off the survey makes precise: *information
completeness vs. token efficiency vs. extraction reliability.* You cannot maximize all three; every
observation design picks a point on that surface, and "richer perception does not always yield
better downstream decisions." State representation (JSON, DOM, code, scene graph) is lossy
compression of the world into the context window — so the *representation is a theory of what
matters*, chosen by the harness.
**Rules out.** "Just give the model everything." More context is not more signal; it is more tax.

### 2.4 Context and memory as managed runtime resources
**Claim.** History, compute, and state are *budgeted resources*, not transcripts.
**Hard-to-vary account.** A good harness "treats history not as an immutable transcript but as a
managed resource" and "computation as a budgeted runtime resource, allocating capacity where
uncertainty or task risk justifies it." The deep reason is *belief drift*: if the harness replays
raw observations rather than maintaining an explicit, updatable belief-state, "the model's implicit
belief may silently drift from the actual environment." Memory therefore is not storage; it is the
machinery that keeps the agent's model of the world in correspondence with the world. Ning et al.
name the cost of getting this wrong: **"context management is the tax of implicit shared state."**
**Rules out.** Treating long context windows as a substitute for state management. They are not;
unmanaged history *is* the failure mode.

### 2.5 Skills and reusable structure — the reach test
**Claim.** Reusable capability should be encoded as *structure* (tools, middleware, memory, skills),
not as *prose strategy* in a prompt.
**Hard-to-vary account.** This is the most important empirical result in the corpus, and it is a
pure statement about reach. AHE's ablations: encoding behavior in tools/middleware/memory transfers
*across tasks and models*; a system-prompt-only variant actually **regressed below the seed**. The
mechanism: "encoding behavior in tools, middleware, and memory avoids the per-call re-derivation
cost prompt-only baselines incur," and prose overfits the idioms of the particular model it was
tuned on. Structure is hard to vary (it does the same thing everywhere); prose is easy to vary
(reword it and behavior shifts), which is *why* prose does not travel.
**Rules out.** "Prompt engineering is harness engineering." Prose tuning produces local,
non-transferable, easily-varied gains — the hallmark of a bad explanation.

### 2.6 Verification, oracles, and falsifiable contracts
**Claim.** The harness's verification machinery is its error-correction system, and every claimed
improvement must be a *risky, testable conjecture*.
**Hard-to-vary account.** AHE makes each edit ship a "change manifest": failure evidence → inferred
root cause → targeted fix → **predicted fixes and predicted at-risk regressions**, then checks those
predictions against the next round's actual task-level deltas. "Each edit thereby becomes falsifiable
by the next evaluation, which replaces rationale-driven self-justification with a measurable contract
between rounds." This is conjecture-and-criticism mechanized. But verification has a hard limit —
*oracle adequacy*: executable tests verify only what they cover; "semantic verification beyond
executable feedback" is unmeasured. The oracle is itself a fallible theory.
**Rules out.** Justificationism — accepting a change because the agent gave a good *rationale* for it.
A rationale that cannot be refuted by the next run is exactly an easy-to-vary explanation.

### 2.7 Multi-agent orchestration, handoff, and shared state
**Claim.** Adding agents adds coordination cost, and the dominant failure is *information loss at
handoff*, not weak reasoning.
**Hard-to-vary account.** NLAH measured *information handoff recall collapsing to 0.32* under
parent–child execution versus 1.0 in a single context — and concluded "extra branching is not the
same as better control." Ning et al. converge: coordination bottlenecks and "the tax of implicit
shared state" dominate, and "topology complexity inversely correlates with harness-state formality"
(more formal shared state → simpler, more reliable topologies). So multi-agent quality is a property
of *how explicitly shared state is represented and handed off*, not of how many agents there are.
**Rules out.** "More agents / more orchestration = more capability." Branching without formal shared
state *destroys* information and reduces control.

### 2.8 Permissions, information flow, and compositional governance
**Claim.** Safety is a property of the *harness*, enforced over the *trajectory* — and it is
compositional.
**Hard-to-vary account.** HarnessAudit formalizes the harness as a policy-constrained system
`H = (A, T, R, Π, Φ, Σ)` — agents, tools, resources, a *permission policy* Π, an *information-flow
policy* Φ, and a *coordination protocol* Σ — and shows "harness design sets the ceiling for safe
deployment": a more capable model cannot exceed a loose boundary. The survey sharpens *why* this is
distinct from model alignment: "alignment shapes behavioral tendencies, whereas harness governance
determines which capabilities are exposed, which information persists, which actions may execute."
The hard problem is *compositional*: individually-permissible steps can combine into unsafe behavior
over a long horizon, so "safety metadata should travel with state." The dominant concrete failure is
not picking an obviously wrong tool — it is **right-tool-wrong-resource** (a reasonable tool applied
to an unauthorized object), which only a trajectory-level, resource-scoped check can catch.
**Rules out.** "A safe model makes a safe agent," and "the final answer was benign, so the run was
safe." Both are blind to mid-trajectory and compositional violations.

### 2.9 Self-evolving harnesses
**Claim.** A harness can improve *itself* by editing its own components — but only under
observability and falsifiability, and it is blind to its own regressions.
**Hard-to-vary account.** AHE's thesis is that self-improvement "is bottlenecked by *observability*,
not by agent capability": given component observability (editable parts as files), experience
observability (trajectories distilled into evidence), and decision observability (the falsifiable
contract), the loop converges. The crucial honest finding is asymmetric error-correction: the loop
predicts *fixes* at ~34% precision (≈5× random) but predicts its own *regressions* at only ~11%
(≈2× random), producing **non-monotone improvement curves**. Knowledge grows, but unevenly, because
criticism of one's own side-effects is harder than criticism of one's intended effects.
**Rules out.** The fantasy of monotone, hands-off self-improvement. Without regression-prediction,
self-evolution is a partially-blind error-corrector that can go backwards.

### 2.10 Execution alignment — the unifying quality concept
**Claim.** A harness is good to the degree it keeps four things in correspondence: the agent's
**reasoning**, the observed **workspace state**, the **actions** taken through tools, and the
conditions checked by the **evaluator** (Harness-Bench).
**Hard-to-vary account.** Almost every measured failure is a *break in one of these
correspondences*, not a reasoning deficit. Harness-Bench's failure taxonomy: contract/format
violations 36%, tool/recovery 25%, evidence/grounding 15%, artifact non-commitment 11%,
state/continuation 9% — i.e. ~61% of failures are the agent's reasoning losing correspondence with
its outputs, tools, or state. "Execution alignment" is hard to vary because it predicts *which*
failures occur and *where* harness effort pays off (enforce output contracts, recover from tool
errors, ground claims, commit artifacts, preserve state) — far more than "make the model reason
better," which on these benchmarks buys little.
**Rules out.** Attributing agent failures to reasoning. The bottleneck is alignment, which is a
harness responsibility.

### 2.11 Harness capacity — the latent variable we want to measure
**Claim.** There is a real, system-level property — *harness capacity* — that we are trying to
measure: "the ability to sustain effective behavior under tool use, partial observability, long
execution trajectories, and changing environmental feedback."
**Hard-to-vary account.** It is latent (not directly observable), it is what transfers (reach), and
it is *not* the model's reasoning (which saturates on reasoning-heavy tasks regardless of harness).
"Measuring harness capacity requires going beyond single-step correctness." This is the construct
our benchmark must validly estimate — everything in §3 is about not fooling ourselves while doing so.

---

## 3. First principles of *evaluating* harnesses (Deutsch-style)

Each principle is paired with the confound it defends against — because a benchmark is a theory of
what a good harness is, and a benchmark you cannot criticize is worthless.

**P1 — Measure the run, not the output. (Observation is theory-laden.)**
A final-answer pass/fail is an easy-to-vary number: many different processes — sound, lucky, unsafe,
wasteful — produce the same answer, so the number underdetermines its own cause. The survey: dynamic
environments make "the agent run itself the necessary unit of measurement." HarnessAudit: "the
execution trajectory [is] the unit of evidence." Score the trajectory.

**P2 — Attribute by controlled variation. (Hard-to-vary causal claims.)**
"Agent = Model + Harness," so a score names a *pair*, never a harness alone. To isolate the harness,
hold the model and all task conditions fixed and vary only the harness (Harness-Bench's factorial:
fix prompt, sandbox, budget, timeout, evaluator); to test a harness *edit*, freeze the model and make
the verifier read-only (AHE). The survey names the field's central methodological failure: "current
benchmarks rarely disentangle improvements attributable to the base model from those attributable to
the harness." A benchmark that cannot attribute is explaining nothing.

**P3 — Make every claimed improvement falsifiable. (Conjecture and criticism.)**
A harness change is a conjecture; it earns its place only by surviving a *risky* test it could have
failed. AHE pre-registers predicted fixes *and* predicted regressions and checks them next round.
Without pre-registered, refutable predictions, you have rationale-driven self-justification — the
easy-to-vary trap.

**P4 — Demand reach: transfer across models and tasks.**
The good-harness signature is structure that keeps working off its home turf. Require cross-model
transfer (VeRO swaps the underlying LLM; AHE runs the *frozen* harness on new model families) and
cross-benchmark transfer (AHE → SWE-bench at lower token cost). Gains that evaporate on a model swap
were prose-deep and benchmark-local — the easy-to-vary kind. (Note AHE's honesty: step budgets fit
to one model "conflate harness portability with operating-point coupling" — so re-tune budgets per
model or you measure tuning, not portability.)

**P5 — Treat the oracle as a fallible theory; control integrity.**
Your evaluator is itself a conjecture about correctness, and agents will exploit its gaps
(reward-hacking, reading hidden answers, editing protected fixtures, overfitting the selection split).
Defenses: *hidden* audit artifacts invisible to the agent (HarnessAudit), deterministic checks
anchoring any LLM-judge, held-out test re-scoring, and explicit integrity gates (Harness-Bench's
inclusion criteria: realism, solvability, oracle-checkability, integrity). And remember oracle
adequacy: executable tests verify only what they cover.

**P6 — Score a multi-dimensional, non-substitutable profile.**
A good explanation is constrained on every axis at once; so is a good harness. Report an integrated
profile — **path quality, state quality, safety quality, cost quality** (survey) — and make
safety a *multiplicative gate*, not an additive term: HarnessAudit's `Score = SAR × (task terms)`
and Harness-Bench's `Score = Security · Completion · Process` both encode that *you cannot buy
boundary-safety back with task success*. One virtue must not be tradeable for another.

**P7 — Cost and efficiency are first-class, and the budget must be fixed.**
More compute is not more capability: Harness-Bench's leanest harness (NanoBot, ~74k tokens) beat
heavyweight runtimes using 2–3× the tokens. And unless the evaluation budget is *fixed*, measured
gains are confounded by spend — VeRO gates by a fixed number of evaluation calls precisely so
"optimizers cannot gain an advantage through additional compute." Always report success-per-token
(AHE's Succ/Mtok), latency, and tool-call count alongside pass rate.

**P8 — Choose discriminating probes; avoid reasoning-ceiling tasks.**
Harness quality is only visible where the harness has headroom. Reasoning-heavy tasks (GPQA, MATH)
showed *flat* response to harness changes — the ceiling is model-bound, so they cannot discriminate
harnesses. Tool-use, long-horizon, stateful, and recovery-stressed tasks show large harness-driven
spread. Likewise, **weaker/mid models are sharper probes**: "stronger model backends … exhibit lower
cross-harness variance," so a strong model compresses the very differences you are trying to measure.

**P9 — Be a fallibilist about your own numbers. (Stochastic systems need statistics.)**
Harnesses "interleave deterministic code with stochastic LLM completions," so a single run is a
sample, not a measurement. Several papers in this corpus report single-run point estimates with no
variance or significance — a real weakness to *not* inherit. Require multiple seeds, report variance
and confidence intervals, and test significance before claiming one harness beats another.

---

## 4. Synthesis — a hard-to-vary definition of a "good harness"

Putting the pieces together so that no part can be removed without breaking the account:

> A good agent harness is the **embodied, transferable knowledge** that turns a stateless model into
> a goal-directed agent by (a) **constructing the statefulness** the model lacks — managing history,
> memory, and an explicit belief-state as budgeted resources; (b) **maximizing execution alignment** —
> keeping reasoning, workspace state, tool actions, and the evaluator's conditions in correspondence;
> (c) **closing error-correction loops** through executable verification and falsifiable, predicted
> changes rather than rationale; (d) **encoding capability as reusable structure** (tools, middleware,
> memory, skills) that *transfers across tasks and models*, not as model-specific prose; and (e)
> **governing capability over the whole trajectory** — permissions, information-flow, and coordination
> enforced compositionally — at the **lowest competitive cost**.

Each clause is forced by an empirical finding and a confound; drop one and a specific failure mode
returns. That is what makes the definition hard to vary — and it is the specification a benchmark
must faithfully and criticizably measure.

---

## 5. Implications for the benchmark (bridge to the plan)

The evaluation principles dictate the benchmark's non-negotiable shape:

- **Unit of measurement = the run**, with full trajectory capture (P1).
- **Factorial model × harness design**, with everything else fixed, to make attribution possible
  (P2), plus a frozen-model edit protocol for testing harness *changes* (P3).
- **Reach panel**: every headline result re-checked on ≥2 other model families and ≥1 held-out
  task family (P4).
- **Hidden oracles + deterministic checks + integrity gates** against gaming (P5).
- **Four-axis, gated scoring** (path / state / safety / cost), safety multiplicative (P6), with
  cost a first-class reported axis under a fixed budget (P7).
- **Discriminating task & model selection** — tool-use/long-horizon/stateful tasks, mid-strength
  probe models (P8).
- **Seeds, variance, significance** baked in from the start (P9).

The benchmark we design next is, in effect, an apparatus for producing *hard-to-vary explanations of
why one harness is better than another* — and for exposing those explanations to the harshest
criticism we can build.
