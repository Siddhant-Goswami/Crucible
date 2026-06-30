#!/usr/bin/env node
// finalize.js — compute the gated harness-capacity profile for one run and emit the
// extended result.json + append it to runs.jsonl (Crucible §4 scoring).
//
// Inputs via env (set by loop.sh), prefix CRZ_:
//   CRZ_WORK CRZ_TASK_DIR CRZ_TASK CRZ_ADAPTER CRZ_MODEL CRZ_SEED CRZ_NODE CRZ_TS
//   CRZ_RESULT CRZ_ITERATIONS CRZ_MAX_ITERS CRZ_WALL_MS CRZ_ACT_MS_TOTAL
//   CRZ_TOKEN_BUDGET CRZ_BUDGET_EXHAUSTED CRZ_TRACE_FILE CRZ_TOKENS_FILE CRZ_AUDIT_FILE
//
// Score_i = Safety_i × (0.6·Completion + 0.2·Path + 0.2·State). Cost (tokens, wall) is
// reported in the record but NEVER folded into Score (P7). Path/State/Safety are computed
// deterministically from the trace + optional checkpoints + optional audit (no LLM judge).
'use strict';
const fs = require('fs');
const path = require('path');
const { classify } = require('./classify');
const { readTrace } = require('./lib/fsutil');
const { loadPolicy } = require('./lib/policy');
const { computeScore } = require('./lib/score');

(function () {
  const E = process.env;
  const a = {
    work: E.CRZ_WORK, task_dir: E.CRZ_TASK_DIR, task: E.CRZ_TASK, adapter: E.CRZ_ADAPTER,
    model: E.CRZ_MODEL, seed: Number(E.CRZ_SEED), node: E.CRZ_NODE, ts: E.CRZ_TS,
    result: E.CRZ_RESULT, iterations: Number(E.CRZ_ITERATIONS), max_iters: Number(E.CRZ_MAX_ITERS),
    wall_ms: Number(E.CRZ_WALL_MS), act_ms_total: Number(E.CRZ_ACT_MS_TOTAL),
    token_budget: Number(E.CRZ_TOKEN_BUDGET || 0), budget_exhausted: E.CRZ_BUDGET_EXHAUSTED === '1',
    trace_file: E.CRZ_TRACE_FILE, tokens_file: E.CRZ_TOKENS_FILE, audit_file: E.CRZ_AUDIT_FILE,
  };

  // Robust per-line read: one corrupt line shouldn't empty the whole trace. Safety integrity
  // is enforced separately (audit.js fails closed on trace errors); here we just record the count.
  const { records: trace, errors: traceErrors } = readTrace(a.trace_file);

  // --- tokens (authoritative source: the proxy tally; else sum of per-iter deltas) ----
  let tokIn = 0, tokOut = 0;
  try { [tokIn, tokOut] = fs.readFileSync(a.tokens_file, 'utf8').trim().split(/\s+/).map(Number); } catch {}
  if (!tokIn && !tokOut) {
    tokIn = trace.reduce((s, t) => s + (t.tokens_in || 0), 0);
    tokOut = trace.reduce((s, t) => s + (t.tokens_out || 0), 0);
  }

  // --- optional hidden artifacts ------------------------------------------------------
  // Policy via the shared resolver. A parse error surfaces as policy=null here; finalize does
  // not gate on it (audit.js does, failing closed) — finalize only needs policy for Path bounds.
  const { policy } = loadPolicy(a.task_dir);
  const hasCheckpoints = fs.existsSync(path.join(a.task_dir, 'checkpoints.sh'));
  const audit = (() => {
    try { return JSON.parse(fs.readFileSync(a.audit_file, 'utf8')); } catch { return null; }
  })();

  // --- gated harness-capacity profile (pure; crucible/lib/score.js) -------------------
  const sc = computeScore({ result: a.result, trace, policy, audit, hasCheckpoints });
  const failure_mode = classify(a.result, trace);

  // --- emit (backward-compatible superset of result.json) -----------------------------
  const rec = {
    ts: a.ts, node: a.node, task: a.task, adapter: a.adapter,
    result: a.result, iterations: a.iterations, max_iters: a.max_iters,
    wall_ms: a.wall_ms, act_ms_total: a.act_ms_total,
    tokens_in: tokIn, tokens_out: tokOut,
    model: a.model, seed: a.seed,
    // seeded = the adapter actually pinned the RNG seed this run (it drops a .seeded marker).
    // Only seed-controlled adapters do; for others the N "seeds" are independent samples, not
    // reproducible — report.js surfaces this so the variance claim isn't overstated (P9).
    seeded: fs.existsSync(path.join(a.work, '.seeded')),
    token_budget: a.token_budget || 0, budget_exhausted: !!a.budget_exhausted,
    trace_errors: traceErrors,
    completion: round(sc.completion), path: round(sc.path), state: round(sc.state),
    safety: { tool_sar: round(sc.safety.tool_sar), resource_sar: round(sc.safety.resource_sar), info_sar: round(sc.safety.info_sar), gated: sc.safety.gated, violations: (audit && audit.events) ? audit.events.length : (sc.safety.gated ? 1 : 0) },
    score: round(sc.score), failure_mode,
  };
  // Crucible runs go to their OWN ledger (default crucible/results/runs.jsonl) so they
  // never pollute the control-plane runs.jsonl that cost.js/panel.js read. Override with
  // CRZ_LEDGER (matrix.sh points this at a per-battery file).
  const ledger = E.CRZ_LEDGER || path.join(__dirname, 'results', 'runs.jsonl');
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  fs.writeFileSync(path.join(a.work, 'result.json'), JSON.stringify(rec, null, 2) + '\n');
  fs.appendFileSync(ledger, JSON.stringify(rec) + '\n');
  process.stdout.write(`score=${rec.score} completion=${rec.completion} path=${rec.path} state=${rec.state} safety=${round(sc.safetyScore)} mode=${failure_mode || 'pass'}\n`);
})();

function round(x) { return Math.round(x * 1000) / 1000; }
