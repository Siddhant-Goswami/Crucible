# Publication Sprint — Crucible v1 → arXiv

> **Purpose:** self-contained roadmap for publishing what exists, with the minimum change needed
> to make it credible. Rewritten 2026-09-17. The earlier NeurIPS-2026-workshop sprint is
> superseded (its Aug 29 / Sep 5 deadlines passed; the paper was not submitted anywhere). The
> plan follows the mentor's seven steps, with four adjustments recorded in §0. Longer-horizon
> work (personal benchmarks, allocation/routing) lives in `../docs/crucible-v2-plan.md` and is
> **out of scope** here except as one future-work paragraph.

## 0. Scope freeze

**Working title:** *CRUCIBLE: An Empirical Study of Harness–Model Compatibility and Delivery in
Local Coding Agents*

**Central question:** Under the tested task and resource conditions, how does coding-agent
configuration affect successful delivery, and what observable failures explain unsuccessful
attempts?

**Three contributions, no more:**
1. A reproducible apparatus for comparing specified harness–model configurations.
2. Empirical results showing configuration-dependent delivery on a bounded task battery.
3. A diagnostic account of compatibility failures, timeouts, and their effect on reported results.

**Primary outcome:** successful completion within the stated deadline, over *attempted* cells.
Goodput and its components are secondary diagnostics. This is a post-hoc analysis choice — say so.

**Adjustments to the mentor's plan (agreed 2026-09-17):**
- *Interface-fit is reworded, not deferred.* Lead with the weights-fixed local contrast
  (codex 0/12 vs pi 3/3 on `qwen3.5:9b`); demote the cloud bookend to a demonstration with the
  model-identity caveat; report §5A.3's refuted prediction as refuted.
- *Metric swap is cheap:* pass-within-deadline is `passed && !timed_out`, already in `report.js`;
  the finished-only vs all-attempted inversion survives as the sensitivity figure.
- *Failure table is a rule-based remap* of the ledger taxonomy (`inventory.js` §A.5), not a
  relabeling campaign.
- *Category:* cs.SE primary (coding agents / SE framing), cross-list cs.AI.

**Keep / change table** — see `INVENTORY.md` §B (13 headlines: 6 keep, 4 reword, 3 defer).

## 1. Steps, owners, done-when

Effort budget: **5–7 focused days** for steps 2–6; endorsement/moderation add calendar time.

| # | Step | Who | Done when |
|---|---|---|---|
| 1 | Scope freeze (above) | both | ✅ 2026-09-17 |
| 2 | **Evidence inventory + claim-to-evidence table** → `paper/INVENTORY.md`; resolve the 9 discrepancies in its §C | Claude | ✅ 2026-09-17 — all 9 §C rows resolved; `inventory.js --check` in CI. Cloud model id recovered from `~/.codex` probe sessions (§C.3), no rerun |
| 3 | **Reanalysis** from frozen ledgers → `paper/REANALYSIS.md` + `figs/sensitivity.tex` + `figs/ladder-pass.tex` (`crucible/tools/reanalysis.js`, `--check` in CI): configuration tables on delivery + clustered CI over matched task sets; 16 pre-named contrasts under both metrics (3 are metric-dependent; cross-size pi@2b vs ollama@9b n.s. → withdrawn); sensitivity table; ladder with params vs GB; safety components | Claude | ✅ 2026-09-17 |
| 4 | **No new campaign.** (a) cloud model identity: recovered from evidence, relabelled as account default; (b) escape claim: reworded to a single observation, `*.integrity.jsonl` no longer ignored | Claude | ✅ 2026-09-17 |
| 5 | **Rewrite `main.tex`** to the §0 structure; 5 new citations positioned in §2 | Claude drafts, **user edits** | ✅ draft 2026-09-17 — compiles clean (tectonic), 11 pp incl. refs + 6 appendices; **user pass on prose still needed** |
| 6 | **Reproducibility release:** `CITATION.cff`, `paper/README.md` (reproduce-the-analysis vs repeat-an-experiment), licences (Terminal-Bench Apache-2.0, repo MIT), `paper/REVIEW-REQUEST.md` for the independent check; tag `v1.0-paper` | Claude packages; **user recruits the two reviewers** | ✅ packaged 2026-09-17; ☐ independent check done; ☐ tag pushed |
| 7 | **arXiv:** account (100x Engineers, Bengaluru), cs.SE + cs.AI, endorsement, license, LaTeX source upload, check compiled PDF, moderation | user | arXiv ID live; linked from README |

### Release checklist (before Submit)
- [ ] Every headline claim is supported by a reported experiment (INVENTORY §B all KEEP/REWORD)
- [ ] All counts, configurations, and model identities reconcile (INVENTORY §C all ☑)
- [ ] Exploratory vs pre-registered distinguished; refuted predictions reported
- [ ] Closest prior work credited with specific differences (5 papers above)
- [ ] Tables and figures regenerate from released records (CI green)
- [ ] Limitations sit beside the conclusions they constrain
- [ ] Source compiles; links to the tagged release
- [ ] One independent reader has checked analysis or manuscript

## 2. After arXiv (not blocking)
ICLR 2027 workshops (~Feb 2027) for the same paper; TMLR as the archival fallback. Then
`../docs/crucible-v2-plan.md`.

## 3. Key commands
```bash
node crucible/tools/inventory.js                 # regenerate INVENTORY.md §A
node crucible/tools/inventory.js --check         # CI: fail if stale
node crucible/audit-claims.js crucible/results/battery.published.jsonl   # drift guard (reads all ledgers)
node crucible/report.js crucible/results/<ledger>.jsonl                  # scorecards
node paper/figs/make-figs.js [--check]           # figures from ledgers
cd paper && tectonic main.tex                    # build
```
