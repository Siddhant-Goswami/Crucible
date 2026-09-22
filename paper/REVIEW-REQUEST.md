# Independent check — request for a reviewer who did not build Crucible

Two separate checks, each ~1 hour. Neither requires an academic background or co-authorship. Please
do them on a clean clone so undocumented assistance can't leak in.

## Check 1 — reproduce one table and inspect one failure (an engineer)

```bash
git clone https://github.com/Siddhant-Goswami/Crucible && cd Crucible
git checkout v1.0-paper
node --version        # needs 22+
node crucible/tools/reanalysis.js --check
node crucible/tools/inventory.js --check
node paper/figs/make-figs.js --check
```

1. **Reproduce Table 2 of the paper** (the within-model configuration table). Open
   `paper/REANALYSIS.md` §1.1 and §1.3 and compare the *Delivery* column for `qwen3:8b` and
   `llama3.2:3b` against `paper/main.pdf` Table 2. Every number should match. If any differs, note
   which.
2. **Recompute one number by hand**, without the scripts:
   ```bash
   node -e '
   const rows=require("fs").readFileSync("crucible/results/phase-d-llama.jsonl","utf8").trim().split("\n").map(JSON.parse)
     .filter(r=>r.adapter==="pi"&&r.model==="llama3.2:3b");
   console.log("attempted",rows.length,"delivered",rows.filter(r=>r.result==="passed"&&!r.timed_out).length);'
   ```
   Expected: attempted 55, delivered 5 (→ 0.09 in the table).
3. **Inspect one failure example.** The paper says `codex` produced no artifact on every local
   cell. Pick any codex row from `crucible/results/qwen35-scaled.jsonl`:
   ```bash
   grep '"adapter":"codex"' crucible/results/qwen35-scaled.jsonl | head -3
   ```
   Confirm each has `"result":"failed"`, `"failure_mode":"artifact_commitment"`, and
   `"completion":0`. Then read `adapters/codex.sh` lines 36–60 and say whether the paper's
   description of the local path (§5.1 "protocol failure") matches what the adapter does.
4. Report: which steps passed, any number that did not match, and anything you needed that was not
   in `paper/README.md`.

## Check 2 — do the conclusions follow from the evidence? (any careful reader)

Read `paper/main.pdf` (about 8 pages + appendices). Then answer, in writing:

1. The abstract makes three findings. For each, find the table or figure that supports it and say
   whether the certainty in the abstract matches the certainty in the results section.
2. Table 3 marks three contrasts as significant under one metric only. Does the text anywhere
   claim one of those as a firm result?
3. §5.1 says the cloud-account arm (20/20) is "a demonstration, not isolating interface
   compatibility." Does any other sentence in the paper contradict that?
4. Appendix D lists a refuted prediction (H3a) and an untested one (primary). Are both stated as
   such in the main text?
5. Is there any claim in the Introduction or Conclusion that you could not trace to a specific
   number in §4–§5?

Send both reports to content@100xengineers.com. Consequential comments will be resolved or
acknowledged in the manuscript before submission (`SPRINT.md` step 6).
