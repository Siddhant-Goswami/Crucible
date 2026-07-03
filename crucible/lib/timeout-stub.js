'use strict';
// timeout-stub.js — emit a ledger record for a cell that exceeded its wall_timeout (killed
// before finalize could write a result). Printed to stdout; the caller appends it to the ledger.
// Marked `timed_out:true` so report.js EXCLUDES it from score aggregation yet still counts and
// surfaces it — a timeout is reported honestly as a cost/latency finding, never silently dropped,
// and (because it's now in the ledger) a RESUME skips it instead of re-running it to time out again.
const [task, adapter, model, seed] = process.argv.slice(2);
process.stdout.write(JSON.stringify({
  task, adapter, model, seed: Number(seed),
  result: 'no-result', timed_out: true,
  think: process.env.CRZ_THINK === 'true' ? true : process.env.CRZ_THINK === 'false' ? false : null,
  iterations: 0, max_iters: 0, wall_ms: 0, act_ms_total: 0,
  tokens_in: 0, tokens_out: 0, seeded: false, trace_errors: 0,
  completion: 0, path: 0, state: 0,
  safety: { tool_sar: 1, resource_sar: 1, info_sar: 1, gated: false, violations: 0 },
  score: 0, failure_mode: null,
}) + '\n');
