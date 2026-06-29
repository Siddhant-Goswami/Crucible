#!/usr/bin/env node
// cost.js — price the loop runs in runs.jsonl using pricing.json.
//
// It reads MEASURED token usage from the ledger (the ollama adapter records real
// prompt_eval_count / eval_count), prices each run by the model its adapter maps
// to, and projects daily / monthly cost at a given run volume — including node
// infra amortization. Local/ollama runs price to $0 marginal, which is the whole
// point of the "safe + lean" recommendation.
//
// Usage:
//   node cost.js                         # summarize runs.jsonl
//   node cost.js --runs-per-day 500      # project at a volume
//   node cost.js --infra vps-hetzner-cx22 --runs-per-day 500
//   node cost.js --model claude-opus-4-8 # re-price every run as if run on this model (what-if)
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const pricing = JSON.parse(fs.readFileSync(path.join(ROOT, 'pricing.json'), 'utf8'));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const runsPerDay = Number(opt('--runs-per-day', 0));
const infraKey = opt('--infra', 'local-mac');
const forceModel = opt('--model', null);

const ledgerPath = path.join(ROOT, 'runs.jsonl');
if (!fs.existsSync(ledgerPath)) { console.error('no runs.jsonl yet — run ./loop.sh or ./compare.sh first'); process.exit(1); }
const runs = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

function priceRun(r) {
  const model = forceModel || pricing.adapterModel[r.adapter] || 'ollama/qwen3:8b';
  const p = pricing.models[model] || { in: 0, out: 0 };
  const usd = ((r.tokens_in || 0) * p.in + (r.tokens_out || 0) * p.out) / 1e6;
  return { model, usd };
}

// per-adapter aggregation
const byAdapter = {};
let totalUsd = 0, totalIn = 0, totalOut = 0;
for (const r of runs) {
  const { model, usd } = priceRun(r);
  const a = (byAdapter[r.adapter] ||= { runs: 0, in: 0, out: 0, usd: 0, model });
  a.runs++; a.in += r.tokens_in || 0; a.out += r.tokens_out || 0; a.usd += usd;
  totalUsd += usd; totalIn += r.tokens_in || 0; totalOut += r.tokens_out || 0;
}

const n = runs.length;
const avgUsd = n ? totalUsd / n : 0;
const avgWall = n ? runs.reduce((s, r) => s + (r.wall_ms || 0), 0) / n : 0;

console.log(`# Cost report  (${n} runs in runs.jsonl${forceModel ? `, re-priced as ${forceModel}` : ''})\n`);
console.log('| Adapter | Runs | Model priced | tok in | tok out | Total $ | $/run |');
console.log('|---------|-----:|--------------|-------:|--------:|--------:|------:|');
for (const [a, v] of Object.entries(byAdapter)) {
  console.log(`| ${a} | ${v.runs} | ${v.model} | ${v.in} | ${v.out} | $${v.usd.toFixed(6)} | $${(v.usd / v.runs).toFixed(6)} |`);
}
console.log(`\nTotals: ${totalIn} in / ${totalOut} out tokens · **$${totalUsd.toFixed(6)}** · avg **$${avgUsd.toFixed(6)}/run** · avg ${Math.round(avgWall)} ms/run`);

if (runsPerDay > 0) {
  const infra = pricing.infra.options[infraKey] || { usd_month: 0, note: 'unknown' };
  const tokDay = runsPerDay * avgUsd;
  const tokMonth = tokDay * 30;
  console.log(`\n## Projection @ ${runsPerDay} runs/day  (infra: ${infraKey} — ${infra.note})`);
  console.log(`- token/inference cost: $${tokDay.toFixed(2)}/day · $${tokMonth.toFixed(2)}/month`);
  console.log(`- node infra:           $${(infra.usd_month / 30).toFixed(2)}/day · $${infra.usd_month.toFixed(2)}/month`);
  console.log(`- **all-in:             $${(tokDay + infra.usd_month / 30).toFixed(2)}/day · $${(tokMonth + infra.usd_month).toFixed(2)}/month**`);
  console.log(`\n_Tip: re-run with \`--model claude-opus-4-8\` to see the same workload priced on a frontier cloud model._`);
}
