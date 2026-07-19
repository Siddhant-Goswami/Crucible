# Anchored tasks — external-validity slice (Sprint 2, S2.1)

Crucible's homegrown battery is its #1 external-validity limitation (see
`docs/crucible-related-work.md` §4). This directory anchors the apparatus against an
**independent, third-party benchmark** by importing a curated slice of
[Terminal-Bench](https://github.com/laude-institute/terminal-bench) through the generic
Crucible task contract (`SPEC.md` §2) via `crucible/tools/import-task.js`.

**Provenance.** Terminal-Bench commit `d28711d` (`original-tasks/`). The exact commit is
pinned in `crucible/tools/anchored-build/TB_COMMIT.txt`; the importer and per-task reference
solvers used to build + validate this set live in `crucible/tools/anchored-build/`.

## The 10 tasks

| id | tier | TB category | oracle checks |
|----|------|-------------|---------------|
| tb-hello-world | T0 | file-operations | `hello.txt` == "Hello, world!" |
| tb-fix-permissions | T1 | system-administration | `process_data.sh` is +x and runs, prints success marker |
| tb-countdown-game | T2 | reasoning/math | arithmetic expr in `output.txt` uses allowed numbers once each, evals to 462 |
| tb-regex-log | T2 | text-processing | regex in `regex.txt` matches exactly the held-out expected dates |
| tb-jsonl-aggregator | T2 | data-processing | `aggregates.json` top-5 users/tags equal recomputed expected |
| tb-recover-obfuscated-files | T2 | security | base64-recovered files in `recovered/` match originals, no extras |
| tb-analyze-access-logs | T2 | data-analysis | `report.txt` counts (2000 / 273 / 83) + top-3 URLs + format |
| tb-mahjong-winninghand | T3 | reasoning/games | `result.txt` win-pattern set per hand matches expected |
| tb-recover-accuracy-log | T3 | data-processing | 7 `recovered_logs/*` files match golden byte-for-line |
| tb-schemelike-metacircular-eval | T4 | interpreters | `eval.scm` interprets held-out programs identically to `interp.py` |

## How the import works (and stays honest)

- **Selection.** From TB's 241 tasks we kept only ones that are *hermetic on a stock macOS host*:
  no network, no `pip`/`apt` build steps, no extra Docker services, stdlib-only oracles, and seed
  state reproducible without a container. (Tasks needing HF downloads, `torch`, `primer3`, 75 MB
  fixtures, `tmux`, etc. were excluded.)
- **Path rewrite.** TB tasks operate in `/app`; Crucible runs in a disposable workdir, so every
  `/app/...` reference in the statement + oracle was rewritten to task-relative.
- **Hidden oracle.** Each TB `pytest` was ported to a stdlib Python checker embedded **base64 inside
  `verify.sh`** (`import-task.js` `check_py`). `loop.sh` keeps `verify.sh` hidden and restores it from
  the pristine task before every gate, so the agent can neither read nor edit the oracle, and the
  checker source never lands on disk as an importable/gameable `*.py`.
- **Held-out grading where it matters.** `tb-schemelike` grades `eval.scm` against a *held-out* program
  set (TB's `shadow_test/`) using a reference `interp.py` embedded in the oracle — the agent only sees
  the example `test/` programs. (The metacircular self-interpretation arm of TB's grader is omitted — a
  strictly *weaker* gate; the direct-vs-`eval.scm` agreement over held-out programs is the core check.)
- **`tb-jsonl-aggregator`** was regenerated at a repo-friendly scale (`TOTAL_RECORDS=15000`, TB's
  deterministic `random.seed(123)` generator) and its expected top-5 tables recomputed from that frozen
  seed — so the instance is ~1 MB instead of 80 MB. Margins at the rank-5/6 boundary are clean
  (users Δ≈$496, tags Δ=6) so the top-5 sets are unambiguous.

## Rebuild / verify

```bash
node crucible/tools/import-task.js --selftest          # oracle-bridge round-trip (CI)
# full rebuild needs a Terminal-Bench checkout at the pinned commit:
#   git clone https://github.com/laude-institute/terminal-bench && git -C terminal-bench checkout d28711d
#   (then point crucible/tools/anchored-build/build-anchored.js at it)
```

Every task self-validated at import time: the pristine seed **fails** `verify.sh` (exit 2) and the
reference solution **passes** (exit 0) — i.e. each oracle discriminates.
