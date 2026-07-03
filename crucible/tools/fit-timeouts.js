#!/usr/bin/env node
// fit-timeouts.js — per-(model, host) wall-timeout re-fit (§5A.1, k frozen at 5).
//
// The autopsy showed fixed per-task wall clocks bake host/model latency into Goodput. The
// registered rule: each model's wall budget derives from k× its median FINISHED T0-floor wall
// time on this host. Operationalization (documented pre-battery): the fit is a model-conditioned
// FLOOR — effective wall_timeout(task, model) = max(task wall_timeout_s, k × T0_median(model)) —
// so slow models gain budget (the confound fix) while long tasks keep their own task-level floor.
//
// Emits crucible/results/timeout-fits.json ({model: seconds}) which matrix.sh applies per cell.
// Models with no T0 data in any ledger are listed as UNFIT — calibrate before running them.
//
// Usage: node crucible/tools/fit-timeouts.js [ledger...]   (default: battery.published.jsonl)

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const K = 5;
const ROUND_S = 30;               // round fits up to a whole half-minute
const T0 = new Set(['hello-sum', 'fizzbuzz', 'roman-numerals']);

const ledgers = process.argv.slice(2);
if (!ledgers.length) ledgers.push(path.join(ROOT, 'crucible', 'results', 'battery.published.jsonl'));

const rows = [];
for (const f of ledgers) rows.push(...fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse));

const byModel = {};
for (const r of rows) {
  if (!T0.has(r.task) || r.timed_out || !r.wall_ms || r.model === 'baseline') continue;
  (byModel[r.model] = byModel[r.model] || []).push(r.wall_ms);
}

const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const fits = {};
console.log(`k=${K} × median finished T0 wall time (host-conditional; ${rows.length} rows read)\n`);
console.log('model                 n(T0)  median_s   fit_s (floor applied via max(task_wt, fit))');
for (const [m, walls] of Object.entries(byModel).sort()) {
  const med = median(walls) / 1000;
  const fit = Math.ceil((K * med) / ROUND_S) * ROUND_S;
  fits[m] = fit;
  console.log(`${m.padEnd(22)}${String(walls.length).padEnd(7)}${med.toFixed(1).padEnd(11)}${fit}`);
}

const out = path.join(ROOT, 'crucible', 'results', 'timeout-fits.json');
fs.writeFileSync(out, JSON.stringify({ k: K, rule: 'effective_wt = max(task_wall_timeout_s, fit_s)', fits }, null, 2) + '\n');
console.log(`\nwrote ${path.relative(ROOT, out)}`);
console.log('UNFIT models (no T0 data yet — calibrate before battery): any model not listed above.');
