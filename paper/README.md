# Crucible v1 — the paper

`main.tex` + `refs.bib` + `figs/*.tex` → `main.pdf`. **Every number in the manuscript is copied from
a generated file** — `REANALYSIS.md` (tables, contrasts, figures) or `INVENTORY.md` §A (cohort
census) — and both generators run in CI with `--check` against the frozen ledgers in
`../crucible/results/`. Do not hand-edit numbers in `main.tex`; re-run the generators.

## Build

```bash
brew install tectonic      # once
cd paper && tectonic main.tex
```

Or upload `main.tex`, `refs.bib`, and `figs/` to Overleaf (pdfLaTeX + natbib).

## Reproduce the analysis (no model runs; ~10 s)

Regenerates every table, figure, and inventory in the paper from the committed run ledgers:

```bash
node crucible/tools/inventory.js          # paper/INVENTORY.md §A  (cohort census, codex census, failure table)
node crucible/tools/reanalysis.js         # paper/REANALYSIS.md + figs/sensitivity.tex + figs/ladder-pass.tex
node paper/figs/make-figs.js              # figs/codex-bookend.tex + figs/ladder.tex
node crucible/tools/clustered-stats.js    # rank-stability noise null (τ = 0.41 vs 0.73)
node crucible/audit-claims.js crucible/results/battery.published.jsonl   # 41 pinned claims
```

`--check` on the first three exits non-zero if the committed output differs from what the ledgers
produce; CI runs all of them (`.github/workflows/crucible.yml`).

## Repeat an experiment (needs Ollama + a harness; minutes)

One instrumented cell — the weights-fixed contrast in §5.1 of the paper:

```bash
ollama pull qwen3.5:9b
npm install -g @mariozechner/pi-coding-agent          # the pi harness (see ../LEARNINGS.md §6 for the others)
CRUCIBLE=1 HARNESS_MODEL=qwen3.5:9b SEED=1 ./loop.sh crucible/tasks/tool-recover pi 6
# → .runs/<task>.pi/result.json + trace.jsonl; verify.sh exit 0 = delivered
```

A full cohort is `crucible/matrix.sh` (see `../crucible/README.md`); the ladder, Phase D, and anchor
cohorts have their own runners (`crucible/phase-d.sh`, `crucible/anchor.sh`). Local cohorts take
hours and are hardware-conditional; the paper's numbers come from the committed ledgers, not from a
re-run.

## Provenance

| Document | Role |
|---|---|
| `INVENTORY.md` | experiment inventory (§A generated), claim-to-evidence table (§B), discrepancy register (§C) |
| `REANALYSIS.md` | generated tables and contrasts under both outcome metrics; §6 is the machine-checked headline block |
| `SPRINT.md` | the publication plan and release checklist |
| `../docs/crucible-hypotheses.md` | the pre-registration document (frozen sections dated before the runs) |
| `../docs/crucible-v2-plan.md` | future work (personal benchmarks / allocation) — out of scope for v1 |

Reused third-party material: ten Terminal-Bench tasks (Apache-2.0, upstream commit `d28711d`,
adapted via `crucible/tools/anchored-build/`); harnesses are installed from their upstream
distributions and are not redistributed here. This repository is MIT.

## Submission (arXiv)

1. Tag the release: `git tag v1.0-paper && git push --tags` (the paper cites this tag).
2. arXiv account under the real name and affiliation; category **cs.SE** primary, cross-list **cs.AI**;
   endorsement per arXiv's instructions if requested.
3. Upload the LaTeX source package: `main.tex`, `refs.bib`, `main.bbl`, `figs/*.tex` (a
   PDF-only upload is not appropriate for LaTeX-generated papers).
4. Check arXiv's compiled PDF, metadata, and links; leave journal-reference empty.
5. After announcement, add the arXiv ID to `CITATION.cff` and the root README.

Before pressing Submit, run the release checklist in `SPRINT.md` and make sure the independent
check in `REVIEW-REQUEST.md` has been done.
