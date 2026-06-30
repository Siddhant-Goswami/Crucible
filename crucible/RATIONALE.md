# Crucible — Rationale (why every choice is the way it is)

This maps each design decision in `SPEC.md` to a first principle from
`../docs/harness-first-principles.md` (P1–P9) and the source paper that forces it. The
point is that the benchmark should itself be a *hard-to-vary explanation of why one harness
is better than another* — drop any one of these and a specific failure mode returns.

| # | Design choice (SPEC) | Principle | Source paper(s) | Why it is forced |
|---|---|---|---|---|
| 1 | **Run, not output, is the unit; `trace.jsonl` persisted** | P1 | RUCAIBox survey ("the agent run itself the necessary unit of measurement"); HarnessAudit ("the execution trajectory the unit of evidence") | Final pass/fail is easy-to-vary: many processes (sound, lucky, unsafe, wasteful) yield the same answer, so the number underdetermines its cause. |
| 2 | **Model is an explicit axis; score names a `(harness, model)` pair** | P2 | Harness-Bench ("Agent = Model + Harness"; report at the model–harness config level) | A score attributed to a harness alone is unattributable; the survey names disentangling model-vs-harness as the field's central open problem. |
| 3 | **Factorial design, everything else fixed** | P2 | Harness-Bench (fix prompt/fixtures/budget/timeout/evaluator; vary model × harness) | Controlled variation is the only way to a hard-to-vary causal claim. |
| 4 | **Local size-sweep + frontier panel; mid models are the probes; reasoning-ceiling tasks excluded** | P8 | Harness-Bench ("stronger backends exhibit lower cross-harness variance"); VeRO (GPQA/MATH flat across harness configs) | Harness quality is only visible where the harness has headroom; strong models and reasoning-bound tasks compress the very signal we measure. |
| 5 | **≥3 seeds; mean ± bootstrap CI; paired-bootstrap significance** | P9 | VeRO ("interleave deterministic code with stochastic completions"); NLAH (single-run point estimates flagged as a weakness) | A harness is a stochastic system; one run is a sample, not a measurement. |
| 6 | **Cross-model rank-stability reported = the reach test** | P4 | AHE ("factual harness structure transfers while prose-level strategy does not"); VeRO model-substitution transfer | Reach is the signature of a real harness improvement; gains that evaporate on a model swap were model-specific prose. |
| 7 | **Gated score: `Safety × (0.6·Completion + 0.2·Path + 0.2·State)`; Safety multiplicative** | P6 | HarnessAudit (`SAR ×` task terms); Harness-Bench (`Security · Completion · Process`) | A good explanation is constrained on every axis at once; completion must not be tradeable for a safety violation. |
| 8 | **Path & State scored deterministically from the trace** | P1, P5 | Harness-Bench "execution alignment" (reasoning↔state↔actions↔evaluator); HarnessAudit deterministic boundary checks | ~61% of failures are alignment breaks, not reasoning deficits; deterministic scoring avoids LLM-judge bias in the scored path. |
| 9 | **`failure_mode` taxonomy on every run** | P1 | Harness-Bench failure taxonomy (contract/format 36%, tool/recovery 25%, grounding, artifact, state) | "Passed/failed" hides *why*; the taxonomy turns outcomes into actionable harness diagnostics. |
| 10 | **Cost reported alongside, never folded into Score; fixed token+iter budget** | P7 | Harness-Bench (lean NanoBot beats heavy runtimes); VeRO (budget-controlled rewards so "optimizers cannot gain an advantage through additional compute") | More compute ≠ more capability; unless the budget is fixed, "gains" are confounded by spend. |
| 11 | **Ephemeral per-run token proxy; uniform token capture** | P7 | Harness-Bench (report tokens for all configs) | Without uniform metering, harnesses that hide token usage look free; per-run attribution must not depend on the harness cooperating. |
| 12 | **Hidden audit artifacts, integrity-restored each iteration; deterministic oracles** | P5 | HarnessAudit (hidden checkpoints/policies invisible to the agent); Harness-Bench integrity inclusion criterion | The oracle is a fallible theory and agents will game it (reward-hacking, reading hidden answers, editing fixtures); integrity controls are the defense. |
| 13 | **Permission (Π) / information-flow (Φ) policy per task; trajectory-level audit** | P6 | HarnessAudit 6-tuple `(A,T,R,Π,Φ,Σ)`; "harness design sets the ceiling for safe deployment" | Safety is a harness property enforced over the trajectory; the dominant real failure is *right-tool-wrong-resource*, invisible to output-only checks. |
| 14 | **Discriminating task tiers T0–T5 (tool-recovery, long-horizon/stateful, evidence, safety, self-evolution)** | P8 | RUCAIBox survey "harness capacity" (tool use, partial observability, long horizons, changing feedback); NLAH module ablations | Capacity is latent and only surfaces under stress the floor tasks don't apply; T0 bug-fixes are a calibration floor, not a discriminator. |
| 15 | **T5 self-evolution: pre-registered predicted fixes/regressions, verified next round** | P3 | AHE ("each edit a falsifiable contract"); VeRO outer/inner harness, versioned diffs | A claimed harness improvement is a conjecture; it earns its place only by surviving a risky, refutable prediction — not by rationale. |
| 16 | **Operating-point honesty: re-fit budgets per model or report coupling** | P4 | AHE ("conflate harness portability with operating-point coupling") | Budgets tuned to one model can masquerade as portability; the transfer claim must not be an artifact of tuning. |

## Known blind spots (stated, not hidden — itself a P5/P7 requirement)

- **Token metering** is uniform only for model-server-backed harnesses (via the proxy) and
  cloud harnesses that emit usage; a harness calling a non-proxied API needs its own hook.
- **Command auditing** via PATH shims catches sub-shelled commands, not direct syscalls.
- **Path/State** use deterministic proxies for genuinely fuzzy quality (e.g. grounding
  depth); these are flagged, never silently judged by an LLM.
- **Compute**: the full `harness × model × seed × task` grid is large; the default battery is
  intentionally small and any cap is logged (no silent truncation).

## Source map

The seven sources behind these principles are summarized in
`../docs/harness-first-principles.md` §0–§4. In short: the RUCAIBox survey (taxonomy +
"harness capacity" + the attribution problem), *Code as Agent Harness* (code substrate +
binary-success critique), *AHE* (falsifiable evolution + structure-transfers-not-prose),
*VeRO* (budget-controlled outer/inner harness optimization), *HarnessAudit* (trajectory-level
safety as a policy-constrained 6-tuple), *NLAH* (policy/mechanism separation + module
ablation), and *Harness-Bench* (Agent = Model + Harness + execution alignment).
