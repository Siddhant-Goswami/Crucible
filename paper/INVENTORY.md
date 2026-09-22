# Crucible v1 — Experiment inventory & claim-to-evidence table

> The first deliverable of the v1 publication sprint (`SPRINT.md` step 2). One place that says,
> for every cohort the manuscript reports: what ran, on what, how many cells were attempted vs
> finished vs passed, whether repeats were true seeds, which commit froze the ledger — and, for
> every headline, which cohort supports it and whether it is **kept, reworded, or deferred**.
> §A regenerates from the ledgers (`node crucible/tools/inventory.js`; `--check` in CI). §B–§D
> are curated and must be edited when the manuscript changes.

---

## A. Experiment inventory (generated)

<!-- BEGIN GENERATED (crucible/tools/inventory.js) -->
_Generated 2026-09-17 by `node crucible/tools/inventory.js` from `crucible/results/*.jsonl` + `git log`. Do not edit by hand._

### A.1 Cohort census (computed from ledgers)

| Ledger | Cohort | Dates | Harnesses | Models | Tasks | Seeds (repeat semantics) | Attempted / finished / passed / timed-out | Think | First commit |
|---|---|---|---|---|--:|---|---|---|---|
| `battery.published` | Pilot (local factorial + Claude slice) | 2026-06-30→2026-07-02 | 8: aider, claude, codex, goose, hermes, mock, ollama, pi | baseline, claude-opus-4-8, deepseek-r1:1.5b, deepseek-r1:8b, gpt-4o-mini, gpt-5.5, qwen3:8b | 9 | 0,1,2,3 (true seed: ollama; others = independent samples) | 515 / 460 / 164 / 55 / gated 11 | n/a | be24dab 2026-07-02 |
| `qwen35-pilot` | qwen3.5:9b three-arm — arm 1 (think default ON) | 2026-07-02 | 4: codex, goose, hermes, pi | qwen3.5:9b | 4 | 1,2,3 (true seed: none; others = independent samples) | 48 / 18 / 3 / 30 | n/a | c211e82 2026-07-02 |
| `qwen35-think-off` | qwen3.5:9b three-arm — arm 2 (think OFF) | 2026-07-02 | 3: goose, hermes, pi | qwen3.5:9b | 4 | 1,2,3 (true seed: none; others = independent samples) | 36 / 33 / 10 / 3 / gated 1 | false/n/a | c211e82 2026-07-02 |
| `qwen35-think-on-repl` | qwen3.5:9b three-arm — arm 3 (think ON replication, healthy host) | 2026-07-02 | 1: pi | qwen3.5:9b | 1 | 1,2,3 (true seed: none; others = independent samples) | 3 / 3 / 2 / 0 | true | c211e82 2026-07-02 |
| `qwen35-hermes-fix` | hermes @ qwen3.5:9b patched slice | 2026-07-02 | 1: hermes | qwen35-9b-ctx16k | 4 | 1,2,3 (true seed: none; others = independent samples) | 12 / 12 / 0 / 0 | false | d204477 2026-07-03 |
| `qwen35-scaled` | Phase C — qwen3.5 size ladder | 2026-07-03 | 5: aider, codex, mock, ollama, pi | baseline, qwen3.5:2b, qwen3.5:4b, qwen3.5:9b | 6 | 0,1,2,3 (true seed: ollama; others = independent samples) | 222 / 200 / 78 / 22 / gated 23 | false | 059541a 2026-07-03 |
| `phase-d-llama` | Phase D — llama3.2:3b third-family arm | 2026-07-18 | 7: aider, codex, goose, hermes, mock, ollama, pi | baseline, llama3.2:3b | 11 | 0,1,2,3,4,5 (true seed: ollama; others = independent samples) | 341 / 336 / 75 / 5 / gated 34 | null | 9d0b857 2026-07-19 |
| `anchor-tb` | External anchor — Terminal-Bench slice | 2026-07-19→2026-07-20 | 7: aider, codex, goose, hermes, mock, ollama, pi | baseline, llama3.2:3b, qwen3.5:9b | 10 | 0,1,2,3 (true seed: ollama; others = independent samples) | 370 / 280 / 24 / 90 | null | 3720c82 2026-07-20 |
| `cloud-b2` | Phase B — codex @ ChatGPT-account model | 2026-07-03 | 1: codex | gpt-5.5 | 4 | 1,2,3,4,5 (true seed: none; others = independent samples) | 20 / 20 / 20 / 0 | null | 409be07 2026-07-03 |
| `cloud-claude-t1` | Phase B — Claude Code on hardened T1 trio | 2026-07-03 | 1: claude | claude-opus-4-8 | 3 | 1,2,3 (true seed: none; others = independent samples) | 9 / 9 / 9 / 0 | null | 409be07 2026-07-03 |
| `cloud-openai-metered` | Phase B — metered OpenAI arm (aider, pi @ gpt-4o-mini) | 2026-07-03 | 2: aider, pi | gpt-4o-mini | 4 | 1,2,3 (true seed: none; others = independent samples) | 24 / 23 / 17 / 1 / gated 4 | null | 73e9871 2026-07-03 |
| `qwen35-t0-calib` | calibration — qwen3.5 T0 timeout fits | 2026-07-03 | 1: ollama | qwen3.5:2b, qwen3.5:4b, qwen3.5:9b | 3 | 1,2,3 (true seed: ollama; others = independent samples) | 27 / 27 / 19 / 0 | false | 1637dbf 2026-07-03 |
| `llama-t0-calib` | calibration — llama3.2:3b T0 timeout fits | 2026-07-18 | 1: ollama | llama3.2:3b | 3 | 1,2,3 (true seed: ollama; others = independent samples) | 9 / 9 / 8 / 0 | null | 9d0b857 2026-07-19 |
| `anchor-t0-calib` | calibration — anchor models T0 timeout fits | 2026-07-19 | 1: ollama | llama3.2:3b, qwen3.5:9b | 3 | 1,2,3 (true seed: ollama; others = independent samples) | 18 / 18 / 17 / 0 | null | 1042127 2026-07-19 |

### A.2 Cohort role, hardening state, and epistemic status (curated; sources: phase notes, `docs/crucible-hypotheses.md` §5A, commit history)

| Ledger | Role in the paper | Hardening / task version | Exploratory vs pre-registered |
|---|---|---|---|
| `battery.published` | headline scorecard (Tab. 1), timeout inversion, safety, reach | pre-Phase-A: no timeout fits, no canary, fixed cell order; tool-recover PRE-hardening (hand-writeable fixture) | exploratory |
| `qwen35-pilot` | dialect-chain result; host-degradation discovery | no fits/canary; host ran into swap (autopsy: host-conditional) | §5A amendment logged before run; 5A.3 prediction (codex >0) REFUTED |
| `qwen35-think-off` | pi@9b Goodput 0.83; timeouts 30/36 → 3/36 | think pinned OFF via proxy; no fits/canary | §5A |
| `qwen35-think-on-repl` | shows arm-1 timeouts were host, not thinking | healthy host; 3 cells only | post-hoc replication |
| `qwen35-hermes-fix` | hermes serving-context fault re-run | context patched; think OFF | post-hoc |
| `qwen35-scaled` | Tab. 2 / Fig. (right); "harness substitutes for scale" | FULL: per-model timeout fits, ORDER_SEED=137 shuffle, health canary; hardened T1 trio | §5A design; ladder subset = 4 harnesses × 6 tasks (declared rule needed) |
| `phase-d-llama` | out-of-sample reach/structural-zero confirmation | FULL (fit 30s, ORDER_SEED=42, canary sidecar); hardened T1 trio | PRE-REGISTERED (hypotheses §5.1); predictions held |
| `anchor-tb` | OOD reproduction of orderings; underpowered | FULL (fits, shuffle, canary sidecar); tasks ADAPTED (hidden base64 Python oracle, paths rewritten) | pre-registered as mitigation; contrast n.s. |
| `cloud-b2` | cloud bookend 20/20 | hardened tool-recover; model = ChatGPT-account default (CLI 0.137.0; resolved to gpt-5.5 in probe sessions minutes before the Jul 2 pilot cells — INVENTORY §C.3; Jul 3 cells inferred, no per-cell record; tokens unmetered) | exploratory demonstration |
| `cloud-claude-t1` | T1 solvability validation | hardened T1; Claude Pro login (cost = cache-inflated upper bound) | validation, not a contrast |
| `cloud-openai-metered` | H3a home-turf de-confound (aider 0/3 vs pi 3/3 on tool-recover) | metered via proxy (real $); hardened tool-recover | exploratory |
| `qwen35-t0-calib` | timeout fits only (not a result cohort) | — | calibration |
| `llama-t0-calib` | timeout fits only | — | calibration |
| `anchor-t0-calib` | timeout fits only | — | calibration |

### A.3 Task sets per cohort

| Cohort | Tasks (n) | Task IDs |
|---|---|---|
| `battery.published` | 9 | `api-migration` `fizzbuzz` `hello-sum` `research-deck` `roman-numerals` `secret-redaction` `self-improving-rubric` `temp-convert` `tool-recover` |
| `qwen35-pilot` | 4 | `api-migration` `secret-redaction` `temp-convert` `tool-recover` |
| `qwen35-think-off` | 4 | `api-migration` `secret-redaction` `temp-convert` `tool-recover` |
| `qwen35-think-on-repl` | 1 | `api-migration` |
| `qwen35-hermes-fix` | 4 | `api-migration` `secret-redaction` `temp-convert` `tool-recover` |
| `qwen35-scaled` | 6 | `api-migration` `hello-sum` `secret-redaction` `tool-recover` `tool-recover-config` `tool-recover-lock` |
| `phase-d-llama` | 11 | `api-migration` `fizzbuzz` `hello-sum` `research-deck` `roman-numerals` `secret-redaction` `self-improving-rubric` `temp-convert` `tool-recover` `tool-recover-config` `tool-recover-lock` |
| `anchor-tb` | 10 | `tb-analyze-access-logs` `tb-countdown-game` `tb-fix-permissions` `tb-hello-world` `tb-jsonl-aggregator` `tb-mahjong-winninghand` `tb-recover-accuracy-log` `tb-recover-obfuscated-files` `tb-regex-log` `tb-schemelike-metacircular-eval` |
| `cloud-b2` | 4 | `api-migration` `secret-redaction` `temp-convert` `tool-recover` |
| `cloud-claude-t1` | 3 | `tool-recover` `tool-recover-config` `tool-recover-lock` |
| `cloud-openai-metered` | 4 | `api-migration` `secret-redaction` `temp-convert` `tool-recover` |
| `qwen35-t0-calib` | 3 | `fizzbuzz` `hello-sum` `roman-numerals` |
| `llama-t0-calib` | 3 | `fizzbuzz` `hello-sum` `roman-numerals` |
| `anchor-t0-calib` | 3 | `fizzbuzz` `hello-sum` `roman-numerals` |

### A.4 Codex census — every cohort, attempted vs finished vs passed

| Cohort | Local attempted | Local finished | Local passed | Models | Cloud attempted / passed (model label) |
|---|--:|--:|--:|---|---|
| `battery.published` | 81 | 77 | 0 | deepseek-r1:1.5b, qwen3:8b, deepseek-r1:8b | 4 / 4 (gpt-5.5) |
| `qwen35-pilot` | 12 | 12 | 0 | qwen3.5:9b | — |
| `qwen35-scaled` | 54 | 54 | 0 | qwen3.5:4b, qwen3.5:9b, qwen3.5:2b | — |
| `phase-d-llama` | 55 | 55 | 0 | llama3.2:3b | — |
| `anchor-tb` | 60 | 60 | 0 | llama3.2:3b, qwen3.5:9b | — |
| `cloud-b2` | 0 | 0 | 0 | — | 20 / 20 (gpt-5.5) |
| **all local cohorts** | **262** | **258** | **0** | | |

### A.5 Failure categories (mentor taxonomy, rule-derived from ledger fields)

| Outcome (rule-derived, exclusive) | `battery.published` | `qwen35-scaled` | `phase-d-llama` | `anchor-tb` |
|---|--:|--:|--:|--:|
| success | 164 | 78 | 75 | 24 |
| timeout | 55 | 22 | 5 | 90 |
| startup/transport (no metered model call) | 54 | 0 | 0 | 6 |
| incompatible tool output (protocol; codex unmetered) | 77 | 54 | 55 | 60 |
| incompatible/unapplied output (model answered, nothing committed) | 119 | 11 | 138 | 124 |
| unsuccessful execution (contract_format) | 22 | 39 | 42 | 13 |
| unsuccessful execution (tool_recovery) | 14 | 17 | 16 | 30 |
| unsuccessful execution (state_continuation) | 8 | 1 | 6 | 23 |
| unsuccessful execution (evidence_grounding) | 2 | 0 | 4 | 0 |
| uncertain | 0 | 0 | 0 | 0 |
| **attempted (sum)** | **515** | **222** | **341** | **370** |
| *overlay: policy violation observed (`safety.gated`, any outcome)* | 11 | 23 | 34 | 0 |
| *overlay: …of which the verifier still passed (gated passes)* | 2 | 9 | 6 | 0 |

*Rule:* success = verifier passed & not timed out (the v1 primary outcome; a gated pass still counts as delivered here and is shown in the overlay) · timeout = `timed_out` · startup/transport = `artifact_commitment` with 0 metered input tokens (non-codex) · codex is unmetered, so its `artifact_commitment` zeros are classed as protocol failures from trace evidence, not tokens · remaining ledger taxonomy values = unsuccessful execution · residue = uncertain. This is a **post-hoc remap for the v1 paper**, not the pre-registered taxonomy.
<!-- END GENERATED -->

**Shared environment (all local cohorts):** one Apple-Silicon host, Darwin 25.5.0 arm64, node
v22.23.1, Ollama 0.30.11; model digests in `crucible/results/ENV.md` (`llama3.2:3b a80c4f17acd5`,
`qwen3.5:{2b 324d162be6ca, 4b 2a654d98e6fb, 9b 6488c96fa5fa}`, `qwen3:8b 500a1f067a9f`,
`deepseek-r1:{1.5b a42b25d8c10a, 8b 28f8fd6cdc67}`). Temperature 0.7. Wall timeouts: task
`wall_timeout_s` in the pilot; `max(task, per-model T0 fit)` from Phase C onward
(`crucible/results/timeout-fits.json`). Token budgets per `task.yaml`.

**Pass criterion used throughout this inventory and the v1 reanalysis:** `result == "passed"`
and not `timed_out` — i.e. *successful completion within the stated deadline*, over **attempted**
cells. Goodput (gated score, timeouts = 0) is the secondary diagnostic.

---

## B. Claim-to-evidence table

Status legend — **KEEP**: supported by a specific cohort as stated · **REWORD**: the evidence
supports a narrower/observational version · **DEFER**: not supportable from existing cohorts;
moves to the future-work paragraph or is dropped.

| # | Headline as currently written (paper §) | Supporting cohort(s) | Pinned claim(s) in `audit-claims.js` | Status | v1 wording / action |
|---|---|---|---|---|---|
| 1 | "Interface-fit, not capability, is often the binding constraint" — codex 0/89 local, 20/20 cloud, "a model swap alone produces a 0→1 discontinuity" (§4.2, abstract, contrib. 2) | `battery.published`, `qwen35-pilot`, `qwen35-scaled`, `phase-d-llama`, `anchor-tb` (local); `cloud-b2` (cloud) | L96, L117, L144, L206, L247, L323, L358 | **REWORD** | Lead with the **weights-fixed local contrast**: on `qwen3.5:9b`, codex 0/12 vs pi 3/3 on tool-recover (same model, same tasks, harness the only change). Report codex as **0 passes in 262 attempted local cells** (A.4 gives per-cohort denominators; drop 89/144). Demote the cloud arm to a *demonstration*: model identity is the ChatGPT-account default (label `gpt-5.5` unverified, tokens unmetered), and native tuning is a confound. Report §5A.3's **refuted** pre-registered prediction (codex predicted >0 on qwen3.5:9b; observed 0) as prediction → outcome → later interpretation. Use "observed protocol/dialect failure", not "isolates interface compatibility". |
| 2 | "The harness substitutes for scale where capability is scarcest" — pi@2b 0.79 vs thin control 0.24, Δ=0.55 [0.18, 0.87]; "beats the control on a model 2.4× larger" (§4.3, abstract) | `qwen35-scaled` | L242 | **KEEP** the within-model contrast (paired, task-clustered); **REWORD** the cross-size sentence | The paired 2b contrast stands. "pi@2b > ollama@9b" is a cross-cell observation with no paired CI — state it as such or compute the clustered CI for that specific pair. Drop "substitutes for scale / buys 2.4× model size" framing (mentor: no claims about replacing an amount of intelligence). Declare the ladder's inclusion rule: 4 harnesses × 6 tasks (subset of the 11). |
| 3 | "Excluding timeouts inverts rankings" — pi 1.00→0.70, goose 0.99→0.33 on qwen3:8b (§4.1, abstract, contrib. 3) | `battery.published` | L79, L86 | **KEEP** as the *reporting-sensitivity* figure | Becomes mentor output #4 (finished-only vs all-attempted). Must carry the autopsy: 51/55 pilot timeouts were host-conditional wall-clock cutoffs (pre-hardening, no fits, fixed order), 4 true hangs (codex). The *inversion* is a property of the reporting rule; the *cause* of those timeouts is host-conditional — say both. |
| 4 | "A multiplicative safety gate catches boundary violations on runs that complete" (§4.5, abstract) | `battery.published` (11 gated rows, 8 aider), `SAFETY-GATE-AUDIT.md` (9 cells manually audited, 0 false positives) | L192 | **KEEP**, fix wording | Replace "any violation collapses/zeroes the score" with the actual rule: high-severity → channel SAR 0; low-severity → −0.15 per event; Safety = min over channels (`audit-core.js:14`). Show Safety, Completion, and the composite as separate columns. State the blind spots (PATH shim, no syscalls; forbid_cmds scope). |
| 5 | "Reach is rare": aider nonzero on all 4 local models; pi/hermes/goose model-specific; τ=0.407 vs seed-null 0.733 (§4.3) | `battery.published`, `phase-d-llama` | L91, L306, L327 | **KEEP** | Out-of-sample on the pre-registered third family. Keep the noise-null τ test. Wording: "the harness *ordering* did not transfer across the models tested", not "advantages are model-specific in general". |
| 6 | Phase D: pi significantly below thin control, Δ(ollama−pi)=0.41 [0.01, 0.75]; aider vs ollama tie Δ=0.05 n.s. (§4.3) | `phase-d-llama` | L312, L319 | **KEEP** | Pre-registered cohort; report as confirmatory. Note CI lower bound is 0.01 — say "narrowly excludes 0". |
| 7 | External anchor reproduces orderings; Δ(pi−ollama)=0.10 [−0.03, 0.28] n.s.; 24/370 pass (§4.3 anchor) | `anchor-tb` | L353, L358, L366, L374, L382 | **KEEP** as an OOD *observation* | Fix the 370-vs-420 arithmetic (6 LLM harnesses × 2 × 3 × 10 = 360 + `mock` × 10 × 1). Describe the adaptation explicitly (hidden base64 Python oracle, path rewrites, no Terminal-Bench container) — it is *not* an unchanged benchmark result. |
| 8 | Routing: "per tier the best local pair ties the frontier … a tier-keyed escalation rule" (§4.6, contrib. 4) | `battery.published` §4 routing table | L103, L109 | **DEFER** | Move to one future-work paragraph. The Claude comparison is 12 cells on a subset of tasks at 1 seed-equivalent; no router baseline was run; the "prompt-difficulty routers can't see this" contrast is against a baseline that was never executed. |
| 9 | "At the frontier quality compresses and cost discriminates" — aider 0.98 vs ollama 0.97 behind Claude-as-model; $1.59 vs $0.27 (§4.4) | `SCORECARD-claude.md` (23 runs; ledger `battery.published` Claude slice) | — (not pinned) | **REWORD** → appendix observation | The shim is `claude -p` tools-off (not agentic Claude Code), cost is a cache-inflated upper bound with a ~22k system-prompt tax, 9 runs per arm. Report as an observation with those limits; do not headline. Also the verifier-gaming lesson (hand-written fixture) stays — it's a task-design finding with trace evidence. |
| 10 | Central thesis / primary prediction: "interface-fit effects are larger than within-class model-capability effects" (§6 prereg, §1) | — (the pre-registered scaled design was only partially executed) | — | **DEFER** | State that the primary prediction was pre-registered and **not tested** in v1 (the ≥3-family × clean/reasoning × ≥2-cloud panel was not completed). Keep the prediction text in the appendix "prediction history". |
| 11 | Timeout autopsy: 51/55 host-conditional, 4 hangs; hardening works (Phase C 22 timeouts all hangs, 0 HOST_DEGRADED; Phase D 0 HOST_DEGRADED) (§4.1) | `TIMEOUT-AUTOPSY.md`, `qwen35-scaled`, `phase-d-llama.canary.jsonl` | L293, L301 | **KEEP** as diagnostic | Present as the failure-analysis section's timeout row. Treat *pilot* rankings affected by host degradation as host-conditional (mentor rule). |
| 12 | Sandbox escape: a harness deleted a file from the pristine task source; guard fired twice in production (§4.5) | `docs/crucible-hypotheses.md` §3 H7 (dated observation, 2026-07-03, pi on `tool-recover-lock`) — **no sidecar on disk or in git** (`*.integrity.jsonl` is gitignored and none survive locally) | — | **REWORD** | Report the single documented observation (pi, T1 piloting, 2026-07-03) as an anecdote with the guard's mechanism (`loop.sh:73`); **drop the "fired twice in production" count** — its evidence was not retained. Un-ignore `*.integrity.jsonl` going forward so future cohorts keep it. |
| 13 | "The harness *is* the capability" / harness effects dominate model capability (README, results §6.7) | — | — | **DEFER / drop from paper** | Mentor's first "change or defer" row. v1 shows *within-model* configuration effects on a bounded battery; it does not estimate the harness-vs-model variance decomposition (that is 2605.23950's claim, and it needs a design v1 doesn't have). |

**Completion condition (mentor §1):** every KEEP/REWORD row names its evidence — a cohort in §A
together with a pinned claim in `audit-claims.js`, or, where no pinned number carries the claim,
the specific artifact that does. Two rows take the second form: row 9 rests on
`SCORECARD-claude.md` (the `battery.published` Claude slice, reported as an appendix observation,
not a pinned headline number) and row 12 on a single dated observation in
`docs/crucible-hypotheses.md` §3 H7 whose sidecar was not retained. No row depends on unfinished
work. Rows 8, 10, 13 are removed from headlines.

---

## C. Discrepancy register (mentor §2) — status

| # | Issue | Verified against | Resolution | Done |
|---|---|---|---|---|
| 1 | Anchor reports 370 cells, stated matrix implies 420 | `anchor-tb.jsonl`: 12 (harness, model) LLM pairs × 30 + `mock@baseline` × 10 seed-0 | Write the sampling explicitly (6 LLM harnesses × 2 models × 3 seeds × 10 tasks + deterministic mock × 10 × 1). | ☑ `main.tex` §4.4 |
| 2 | Codex denominators 89 / 144 / "+54" | A.4 census: 81 + 12 + 54 + 55 + 60 = **262 attempted**, 258 finished (4 pilot hangs), **0 passed** | One table (A.4) in the appendix; body text cites "0 passes in 262 attempted local cells across five cohorts"; distinguish attempted from finished. | ☑ A.4 + `main.tex` §5.1, Fig. 1 (0/262 attempted) |
| 3 | Cloud codex model is the account default | `adapters/codex.sh:61` ("named models are rejected on a ChatGPT plan, so DON'T pass -m"); `cloud-b2.jsonl` tokens 0; `PHASE-B-CLOUD.md` already notes "gpt-5.5 is a ledger label" | **Resolved from recorded evidence (2026-09-17):** battery cells run `codex exec --ephemeral`, so no per-cell session log exists. But `~/.codex/sessions/2026/07/02/` holds three `codex_exec` probe sessions (CLI **0.137.0**, provider `openai`, ChatGPT auth) recorded at 06:46–06:48 UTC — **3–5 minutes before** the pilot's four cloud cells (06:51–06:52 UTC) — whose turn context resolved the account model to **`gpt-5.5`** (two sessions; a third records `gpt-5-codex`, consistent with an explicit `-m` probe). The Jul 3 `cloud-b2` cohort (06:14–06:26 UTC) has no proximal probe; its label is inferred from the same account 24 h later. **Paper wording:** "Codex CLI 0.137.0 on its ChatGPT-account default model, which resolved to `gpt-5.5` in probe sessions recorded minutes before the Jul 2 cells; the Jul 3 cells are attributed to the same account without a per-cell record." Keep the model name with this caveat; do not claim provider-verified identity for `cloud-b2`. | ☑ |
| 4 | Code revision per frozen cohort | `git log --diff-filter=A` per ledger (A.1 "First commit" column) | Appendix table: ledger → commit that froze it → commit of the adapters/tasks at that point (same commit bounds it). Tag a release (`v1.0-paper`). | ☑ A.1 + `main.tex` App. A; tag on the release commit |
| 5 | Pre-registered prediction reframed post hoc | `docs/crucible-hypotheses.md` §5A.3 predicted codex **>0** on qwen3.5:9b; observed 0/12; `main.tex:306` says "sharpens the mechanism" | Prediction-history appendix: each pre-registered prediction with outcome (held / refuted) and the post-hoc interpretation in a separate column. §5A.3 = **refuted**. | ☑ `main.tex` §5.1 + App. D |
| 6 | Safety prose vs implementation | `crucible/lib/audit-core.js:7-14` | Rewrite §3 and §4.5 to the high/low severity rule; show components separately. | ☑ `main.tex` §3, §5.3, Table 5, App. C |
| 7 | *(found during inventory)* Sandbox-escape count has no committed evidence | `.gitignore`: `crucible/results/*.integrity.jsonl`; no sidecar files exist locally either | Reword per B.12 (single documented observation, no count). Stop ignoring `*.integrity.jsonl`. | ☑ `main.tex` §5.3 (single observation, no rate); `.gitignore` updated |
| 8 | *(found during inventory)* Pilot `tool-recover` is pre-hardening; every later cohort is post-hardening (commit `e3b5867`, 2026-07-03) | A.1 dates vs commit date | Never pool pilot T1 cells with later T1 cells; label the task version in every T1 table. | ☑ `main.tex` §5.4, App. B |
| 9 | *(found during inventory)* Ladder cohort is a declared subset (4 harnesses × 6 tasks); Phase D is 11 tasks; pilot is 9 | A.3 | State each cohort's inclusion rule where its table appears; compare only on matched task sets. | ☑ `main.tex` Table 1, §3; `REANALYSIS.md` matched sets |

---

## D. Analysis outputs to regenerate for v1 (mentor §3)

| Output | Source | Script | Exists today? |
|---|---|---|---|
| 1. Configuration results table (completion-within-deadline, attempted n, finish rate, CI) per harness×model | `battery.published`, `phase-d-llama`, `qwen35-scaled` | `report.js` has Completion, Rel%, Goodput, Score\|fin — add a pass-rate-over-attempted column + task-clustered CI | partial |
| 2. Size-ladder figure (parameter count vs stored GB stated separately) | `qwen35-scaled` | `paper/figs/make-figs.js` (ladder panel) — switch y to pass rate, add param counts from `ENV.md` | partial |
| 3. Failure-analysis table (mentor taxonomy + uncertain) | four main cohorts | A.5 above (`inventory.js`) | **yes (new)** |
| 4. Reporting-sensitivity figure (finished-only vs all-attempted) | `battery.published` | new panel in `make-figs.js` from the L79 data | no |
| 5. Codex census table | all cohorts | A.4 above | **yes (new)** |
| 6. Prediction-history appendix | `crucible-hypotheses.md` §3, §5A | hand-written | no |
