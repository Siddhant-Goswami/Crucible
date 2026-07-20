# Submission Sprint — Crucible workshop paper

> **Purpose:** self-contained roadmap for taking the paper from its current state to a
> workshop submission. Written 2026-07-19 so a fresh session (or collaborator) can pick up
> any task without prior context. Target: **NeurIPS 2026 workshop contribution deadline,
> ~Aug 29, 2026** (each workshop sets its own exact date — verify in S3.1).

## Current state (as of commit 9d0b857, 2026-07-19)

- `paper/main.tex` + `paper/refs.bib` compile to a 7-page PDF (`cd paper && tectonic main.tex`).
  Framing: apparatus + exploratory pilot + pre-registered confirmation (per
  `docs/crucible-hypotheses.md` §0). Author block: Siddhant Goswami, sole, non-anonymous.
- All 16 bibliography arXiv IDs verified against the arXiv API 2026-07-18 (see provenance
  note in `docs/crucible-related-work.md`).
- **Phase D confirmatory arm is DONE and folded in**: `llama3.2:3b` (3rd local family) ×
  6 LLM harnesses × 11 tasks (incl. hardened T1 trio) × 5 seeds (330) + deterministic
  `mock` × 11 tasks × 1 seed (11) = 341 cells, 0 errors,
  0 HOST_DEGRADED. Ledger frozen at `crucible/results/phase-d-llama.jsonl`; scorecard
  `SCORECARD-phase-d-llama.md`; writeup `docs/crucible-results.md` §6.8. Headlines: aider
  0.64 (top lean, nonzero on 4th model/3rd family); pi 0.18 (significantly below thin
  control, Δ=0.41 [0.01, 0.77] task-clustered bootstrap); codex 0/144 local; hardened T1
  passed only by tool-callers (pi 3/15).
- Runner: `crucible/phase-d.sh` (calibrate/start/status/stop, detached via launchd).
- Everything committed on `main`, **not pushed**.

## Sprint 1 (now → Jul 26) — freeze evidence + preprint

| # | Task | Who | Done when |
|---|------|-----|-----------|
| S1.1 | ✅ **DONE 2026-07-19.** Pin the §6.8 Phase D claims in `crucible/audit-claims.js` (aider 0.64/93%, pi 0.18, Δ(ollama−pi)=0.41 CI excl. 0, codex 0/55 in phase-d ledger, T1 pi 3/15, 0 HOST_DEGRADED, 341 rows) reading `phase-d-llama.jsonl`; CI must fail on drift. *Claims 27–34 added (36 total, all pass; perturbation verified to fail). The clustered-bootstrap CIs are now seeded/deterministic — doc + paper endpoints updated to the canonical values: Δ(ollama−pi)=0.41 [0.01, 0.75], Δ(aider−ollama)=0.05 [−0.04, 0.17]. T1 clarified: pi 3/15 clean (score ≥0.9), 5 verifier passes of which 2 safety-gated.* | Claude | `node crucible/audit-claims.js` passes; a deliberately perturbed number fails |
| S1.2 | ✅ **DONE 2026-07-19.** Figures: (a) codex interface-fit discontinuity — 0/144 local vs 20/20 gpt-5.5, bar chart; (b) qwen3.5 size ladder Goodput curves (pi/ollama/aider/codex × 2b/4b/9b, Table 2 data). *`paper/figs/make-figs.js` regenerates both panels as TikZ from the frozen ledgers and dies on census drift; CI runs `make-figs.js --check`. PDF now 8 pages (limit 9).* | Claude | PDF recompiles with both figures, sourced from committed ledgers |
| S1.3 | Decide author block + affiliation (currently sole author, 100x email). Settle co-authors BEFORE arXiv | **User** | final author list in main.tex |
| S1.4 | Make the GitHub repo public (paper cites it as the artifact) | **User** | repo URL resolves publicly |
| S1.5 | arXiv submission: create/verify account, obtain endorsement if needed (cs.SE primary, cross-list cs.AI/cs.LG — endorsement can take days, START EARLY), upload, get arXiv ID | **User** (Claude preps the tarball) | arXiv ID live |
| S1.6 | Push `main` to remote (was held back on request) | **User** | remote up to date |

## Sprint 2 (Jul 27 → Aug 16) — external anchor (highest-value science left)

| # | Task | Who | Done when |
|---|------|-----|-----------|
| S2.1 | ✅ **DONE 2026-07-19.** Selected 10 hermetic Terminal-Bench tasks (commit `d28711d`), T0→T4, imported to `crucible/tasks/anchored/`. Extended `import-task.js` with a hidden base64-embedded Python oracle (`check_py`) + `dirs`; each task self-validates (pristine fails, reference passes). Provenance in `tasks/anchored/README.md`; importer archived in `tools/anchored-build/`. | Claude | task dirs under `crucible/tasks/anchored/` with hermetic self-tests passing |
| S2.2 | ✅ **DONE 2026-07-20.** Calibrated (S2.2a) + ran the 370-cell battery detached via `crucible/anchor.sh` (7 harnesses × {qwen3.5:9b, llama3.2:3b} × 3 seeds, §5A hardening). Ledger `anchor-tb.jsonl` (24 passes, 90 timeouts); scorecard `SCORECARD-anchor-tb.md`. | Claude | ledger complete, scorecard rendered |
| S2.3 | ✅ **DONE 2026-07-20.** Folded into paper §\ref{sec:anchor} (+ intro, threats "homegrown tasks", pre-registered status). Writeup in `docs/crucible-results.md` §6.9. Claims 35–39 pinned in `audit-claims.js` (all 41 pass). *Headline: structural orderings reproduce OOD — codex 0/60, hermes 0/60, lean harnesses lead (pi 0.19 > aider 0.13 > ollama 0.11) — but underpowered at 10 tasks (Δ(pi−ollama)=0.10 [−0.03, 0.28], CI incl. 0), and the tasks are hard for these local models (passes only on the trivial tiers). PDF still 8pp.* | Claude | PDF updated; audit-claims covers anchor numbers |
| S2.4 | arXiv v2 with anchor results | **User** | v2 live |

## Sprint 3 (Aug 17 → Aug 29) — venue + submission

| # | Task | Who | Done when |
|---|------|-----|-----------|
| S3.1 | ✅ **DONE 2026-07-19** (early — acceptances went out Jul 11; shortlist below). Research the published NeurIPS 2026 accepted-workshop list; shortlist agent-evaluation / agents-in-the-wild / LLM-eval successors; confirm each's exact deadline, page limit, anonymization policy, style file | Claude | shortlist w/ deadlines in this file |
| S3.2 | Pick the workshop | **User** | decision recorded here |
| S3.3 | Reformat: swap preamble for the workshop `.sty`, anonymize if double-blind (strip author block, de-identify repo link via anonymous.4open.science if required), fit page limit (move Phase D detail to appendix if needed) | Claude | venue-compliant PDF |
| S3.4 | OpenReview account (work email) + submit; verify PDF renders in their viewer | **User** | submission confirmed |
| S3.5 | Fallbacks if timing slips: TMLR (rolling, archival) or ICLR 2027 workshops (~Feb 2027) | — | — |

### S3.1 shortlist (researched 2026-07-19)

NeurIPS 2026 is **multi-venue**: Sydney (workshops Dec 11–12), Paris & Atlanta (Dec 12–13).
Workshop acceptances were announced Jul 11, 2026; venue-recommended contribution deadline is
Aug 29, mandatory author notification Sep 29. 26 workshops are live on OpenReview so far
(`api2.openreview.net/groups?parent=NeurIPS.cc/2026/Workshop`) — more may still appear;
re-check before S3.2. Ranked by fit:

| Rank | Workshop | City | Deadline | Format | Blind? | Notes |
|---|---|---|---|---|---|---|
| 1 | **SLM-Agents** — 1st Workshop on SLMs for Agentic Systems (`slmw2026.github.io`) | Paris | **Aug 29 AoE** | 4pp abstract or 8pp full + refs, NeurIPS workshop template, non-archival | **double-blind** | Dead-center fit: small local models in agentic systems, efficiency metrics, trustworthiness. Crucible's "harness substitutes for scale" result is a headline claim for this audience. Needs anonymized variant (S3.3). |
| 2 | **JUDGe** — Reliable Evaluation for Language Models (`judge2026.github.io`) | Atlanta | **Sep 5 AoE** (a week extra) | 6pp full / 4pp short + refs, NeurIPS template, non-archival | **double-blind** | Evaluation-methodology angle: construct validity, benchmark construction, timeout-exclusion bias, CI drift guard. Welcomes negative results + works in progress. |
| 3 | **Verify-Agents** — Who Verifies the Agents? (`verify-agents-workshop.github.io`) | Sydney | Aug 29 AoE | CFP details **still pending** on site | TBD | Pillars include reward hacking / specification gaming (our verifier-gaming + hardening finding) and multi-objective eval (cost/safety). Watch the site. |
| 4 | **SEA** — Scaling Environments for Agents (`sea-workshop.github.io`) | TBD | Aug 29 | 4pp short / 9pp long + refs, non-archival | not stated | Environment design & benchmarking + terminal/SWE environments tracks; apparatus-as-artifact fits. Not yet on OpenReview. |
| 5 | **VeriCodeGen** — AI for Verifiable Coding (`vericodegen.github.io`) | Atlanta | Aug 29 AoE | not yet published | TBD | Weaker fit (formal-methods slant), but coding-agent verification is in scope. |

Also live but weaker fits: Meta-Agents (agents managing agents, Sydney), FAST (agentic-systems
theory, Paris), MLForSys (Sydney). The NeurIPS 2026 Evaluations & Datasets main track is closed
for this cycle — it stays a 2027 target (backlog).

## Backlog (post-submission / main-track upgrade)

- Path/State construct validity: human-label a stratified trace sample, report κ
  (pre-registered, hypotheses §5.5).
- Second-machine replication slice (rankings portable, latency not).
- Difficulty-router contrast for H5 (prompt-length baseline).
- Close the pristine-guard gap found 2026-07-19: a harness escaped to REPO ROOT during
  Phase D (`.roots/.build.lock`, now gitignored) — root-level writes aren't logged by the
  task-source integrity guard; extend the guard, and report as sandbox-containment data.
- Scale tasks 3–5× + Croissant/RAI metadata → NeurIPS 2027 Evaluations & Datasets or
  ICLR 2027 main track.

## Key commands

```bash
cd paper && tectonic main.tex                       # build the paper
node crucible/audit-claims.js                       # docs↔data drift guard
node crucible/report.js crucible/results/phase-d-llama.jsonl   # re-render Phase D scorecard
./crucible/phase-d.sh status                        # battery runner (idle now)
```
