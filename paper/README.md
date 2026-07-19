# Crucible — workshop paper

`main.tex` + `refs.bib` → `main.pdf` (currently 7 pages incl. references).

## Build

```bash
brew install tectonic     # once
cd paper && tectonic main.tex
```

Or upload `main.tex` + `refs.bib` to Overleaf (pdfLaTeX + natbib).

## Framing (do not drift from this)

An **empirical measurement study + reusable apparatus** — NOT a definitive-benchmark paper.
The 515-run battery is labeled an *exploratory pilot* throughout; confirmatory claims are
deferred to the pre-registered design (§7 of the paper, §5/§5A of
`../docs/crucible-hypotheses.md`). This honesty is a feature reviewers reward, not a weakness.

## Submission targets (as of 2026-07-18)

| Venue | Deadline | Fit |
|---|---|---|
| NeurIPS 2026 workshops (San Diego, Dec 11–12) | contributions ~**Aug 29, 2026** | primary target — watch the accepted-workshop list for the LLM-Evaluation / Agents-in-the-Wild successors |
| ICLR 2027 main | ~mid-Sept 2026 | needs the confirmatory battery + external anchor first |
| TMLR | rolling | archival fallback; venue of "AI Agents That Matter" — rewards rigor over scale |
| ICLR 2027 workshops | ~Feb 2027 | backup if NeurIPS timing slips |

Most workshop styles are mandatory at submission: swap the preamble for the workshop's `.sty`
when the venue is chosen (the body is style-agnostic; only the preamble changes).

## Before submitting — checklist

- [ ] Rerun `node ../crucible/audit-claims.js` and cross-check every number in §4 of the paper
      against the frozen ledgers (the paper hand-copies numbers; the CI guard covers the docs,
      not this tex file).
- [ ] Confirmatory Phase D (third model family, 5 seeds, hardened T1) — fold results into §4/§7
      or explicitly mark still-pending.
- [ ] De-anonymize/anonymize per venue rules (author block is currently non-anonymous).
- [ ] If the venue wants an artifact link, point to the public repo + `battery.published.jsonl`.
- [ ] Citations were verified against the arXiv API on 2026-07-18 (all IDs in refs.bib resolve;
      see provenance note in `../docs/crucible-related-work.md`). Re-verify at camera-ready.
