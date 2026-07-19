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
  7 harnesses × 11 tasks (incl. hardened T1 trio) × 5 seeds = 341 cells, 0 errors,
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
| S1.1 | Pin the §6.8 Phase D claims in `crucible/audit-claims.js` (aider 0.64/93%, pi 0.18, Δ(ollama−pi)=0.41 CI excl. 0, codex 0/55 in phase-d ledger, T1 pi 3/15, 0 HOST_DEGRADED, 341 rows) reading `phase-d-llama.jsonl`; CI must fail on drift | Claude | `node crucible/audit-claims.js` passes; a deliberately perturbed number fails |
| S1.2 | Figures: (a) codex interface-fit discontinuity — 0/144 local vs 20/20 gpt-5.5, bar chart; (b) qwen3.5 size ladder Goodput curves (pi/ollama/aider/codex × 2b/4b/9b, Table 2 data). Generate from ledgers (script in `paper/figs/`), include in main.tex, keep page count ≤ limit | Claude | PDF recompiles with both figures, sourced from committed ledgers |
| S1.3 | Decide author block + affiliation (currently sole author, 100x email). Settle co-authors BEFORE arXiv | **User** | final author list in main.tex |
| S1.4 | Make the GitHub repo public (paper cites it as the artifact) | **User** | repo URL resolves publicly |
| S1.5 | arXiv submission: create/verify account, obtain endorsement if needed (cs.SE primary, cross-list cs.AI/cs.LG — endorsement can take days, START EARLY), upload, get arXiv ID | **User** (Claude preps the tarball) | arXiv ID live |
| S1.6 | Push `main` to remote (was held back on request) | **User** | remote up to date |

## Sprint 2 (Jul 27 → Aug 16) — external anchor (highest-value science left)

| # | Task | Who | Done when |
|---|------|-----|-----------|
| S2.1 | Select 10–20 Terminal-Bench tasks importable via `crucible/tools/import-task.js` (need: files + a shell command that passes iff solved; container-dependent tasks may need env provisioning — pick self-contained ones first) | Claude | task dirs under `crucible/tasks/anchored/` with hermetic self-tests passing |
| S2.2 | Run the anchor battery: installed harnesses × {qwen3.5:9b, llama3.2:3b} × 3 seeds, full §5A hardening (fit timeouts first via a T0-style calibration on the anchor slice; seeded shuffle; canary). Use `run-detached.sh` pattern; new ledger `crucible/results/anchor-tb.jsonl` (+ gitignore exception) | Claude | ledger complete, scorecard rendered |
| S2.3 | Fold anchor results into the paper §4 (or report honestly if they complicate the story — either strengthens it); update threats section ("homegrown tasks" mitigation now partially executed); pin claims | Claude | PDF updated; audit-claims covers anchor numbers |
| S2.4 | arXiv v2 with anchor results | **User** | v2 live |

## Sprint 3 (Aug 17 → Aug 29) — venue + submission

| # | Task | Who | Done when |
|---|------|-----|-----------|
| S3.1 | Research the published NeurIPS 2026 accepted-workshop list; shortlist agent-evaluation / agents-in-the-wild / LLM-eval successors; confirm each's exact deadline, page limit, anonymization policy, style file | Claude | shortlist w/ deadlines in this file |
| S3.2 | Pick the workshop | **User** | decision recorded here |
| S3.3 | Reformat: swap preamble for the workshop `.sty`, anonymize if double-blind (strip author block, de-identify repo link via anonymous.4open.science if required), fit page limit (move Phase D detail to appendix if needed) | Claude | venue-compliant PDF |
| S3.4 | OpenReview account (work email) + submit; verify PDF renders in their viewer | **User** | submission confirmed |
| S3.5 | Fallbacks if timing slips: TMLR (rolling, archival) or ICLR 2027 workshops (~Feb 2027) | — | — |

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
