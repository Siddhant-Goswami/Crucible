#!/usr/bin/env node
// clustered-stats.js — review blockers #2/#3 on the frozen pilot ledger (pure analysis, no runs).
//
// (A) TASK-CLUSTERED bootstrap for the pre-named paired comparisons. The published CIs resample
//     runs as if independent, but runs within a task share its difficulty — the honest unit of
//     resampling is the TASK (cluster), per "Adding Error Bars to Evals" (2411.00640). We report
//     both: clustered (primary) and run-level (sensitivity / comparison with the published CI).
// (B) RANK-STABILITY NOISE NULL for H2. "The harness ordering changes across models" is only
//     evidence if the observed instability exceeds what seed noise alone produces under a COMMON
//     true ordering. Null: pool each harness's runs across model columns (common ordering by
//     construction), resample columns of the original sizes, recompute mean pairwise Kendall τ.
//     p = P(null τ <= observed τ); small p ⇒ instability is real, not sampling noise.
//
// Deterministic: seeded mulberry32 RNG. Usage: node crucible/tools/clustered-stats.js [ledger]

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const LEDGER = process.argv[2] || path.join(ROOT, 'crucible', 'results', 'battery.published.jsonl');
const B = 10000, NULL_B = 2000;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260702);
const choice = (arr) => arr[Math.floor(rnd() * arr.length)];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

const runs = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
  .filter(r => r.adapter !== 'mock' && r.adapter !== 'claude');
// Goodput semantics: every attempt counts; timeout stubs already carry score 0.
const score = (r) => r.score ?? 0;

// ---------- (A) pre-named paired comparisons, clustered by task ------------------------------
const COMPARISONS = [
  { a: 'aider', b: 'ollama', model: 'deepseek-r1:1.5b', published: '0.37 [0.158, 0.58] sig' },
  { a: 'aider', b: 'ollama', model: 'deepseek-r1:8b', published: '0.183 [0.012, 0.368] sig' },
  { a: 'hermes', b: 'ollama', model: 'qwen3:8b', published: '0.029 [-0.022, 0.112] n.s.' },
];

console.log('== (A) paired comparisons: task-clustered vs run-level bootstrap ==\n');
for (const c of COMPARISONS) {
  // pair runs by (task, seed) present for both adapters on this model
  const byKey = {};
  for (const r of runs) {
    if (r.model !== c.model) continue;
    if (r.adapter !== c.a && r.adapter !== c.b) continue;
    const k = r.task + '|' + r.seed;
    (byKey[k] = byKey[k] || {})[r.adapter] = score(r);
  }
  const pairs = Object.entries(byKey)
    .filter(([, v]) => v[c.a] !== undefined && v[c.b] !== undefined)
    .map(([k, v]) => ({ task: k.split('|')[0], d: v[c.a] - v[c.b] }));
  const tasks = [...new Set(pairs.map(p => p.task))];
  const byTask = {};
  pairs.forEach(p => (byTask[p.task] = byTask[p.task] || []).push(p.d));

  const obs = mean(pairs.map(p => p.d));
  const clustered = [], runlevel = [];
  for (let i = 0; i < B; i++) {
    // clustered: resample tasks, take all their pairs
    const ds = [];
    for (let j = 0; j < tasks.length; j++) ds.push(...byTask[choice(tasks)]);
    clustered.push(mean(ds));
    runlevel.push(mean(Array.from({ length: pairs.length }, () => choice(pairs).d)));
  }
  clustered.sort((x, y) => x - y); runlevel.sort((x, y) => x - y);
  const ci = (v) => `[${pct(v, 0.025).toFixed(3)}, ${pct(v, 0.975).toFixed(3)}]`;
  const sig = (v) => (pct(v, 0.025) > 0 || pct(v, 0.975) < 0) ? 'SIGNIFICANT' : 'n.s.';
  console.log(`${c.a} - ${c.b} @ ${c.model}   (n=${pairs.length} pairs, ${tasks.length} task clusters)`);
  console.log(`  published (run-level):    ${c.published}`);
  console.log(`  run-level re-run:  Δ=${obs.toFixed(3)} ${ci(runlevel)}  ${sig(runlevel)}`);
  console.log(`  TASK-CLUSTERED:    Δ=${obs.toFixed(3)} ${ci(clustered)}  ${sig(clustered)}\n`);
}

// ---------- (B) rank-stability noise null -----------------------------------------------------
const MODELS = ['deepseek-r1:1.5b', 'qwen3:8b', 'deepseek-r1:8b'];
const harnesses = [...new Set(runs.map(r => r.adapter))]
  .filter(h => MODELS.every(m => runs.some(r => r.adapter === h && r.model === m)));

function kendallTau(x, y) {
  let c = 0, d = 0;
  for (let i = 0; i < x.length; i++)
    for (let j = i + 1; j < x.length; j++) {
      const s = (x[i] - x[j]) * (y[i] - y[j]);
      if (s > 0) c++; else if (s < 0) d++;   // ties contribute to neither
    }
  return (c - d) / (c + d || 1);
}
const colScores = (getRuns) => MODELS.map(m => harnesses.map(h => mean(getRuns(h, m).map(score))));
const meanPairTau = (cols) => {
  const taus = [];
  for (let i = 0; i < cols.length; i++)
    for (let j = i + 1; j < cols.length; j++) taus.push(kendallTau(cols[i], cols[j]));
  return mean(taus);
};

const cellRuns = (h, m) => runs.filter(r => r.adapter === h && r.model === m);
const obsTau = meanPairTau(colScores(cellRuns));

// null: common ordering by construction — pool each harness across models, resample columns
const pooled = {};
harnesses.forEach(h => (pooled[h] = runs.filter(r => r.adapter === h && MODELS.includes(r.model))));
const nullTaus = [];
for (let i = 0; i < NULL_B; i++) {
  nullTaus.push(meanPairTau(MODELS.map(m => harnesses.map(h => {
    const n = cellRuns(h, m).length;
    return mean(Array.from({ length: n }, () => score(choice(pooled[h]))));
  }))));
}
nullTaus.sort((x, y) => x - y);
const p = nullTaus.filter(t => t <= obsTau).length / NULL_B;
console.log('== (B) H2 rank-stability noise null ==\n');
console.log(`harnesses: ${harnesses.join(', ')}`);
console.log(`observed mean pairwise Kendall τ across model columns: ${obsTau.toFixed(3)}`);
console.log(`null (common ordering + seed noise): 5th pct ${pct(nullTaus, 0.05).toFixed(3)}, ` +
            `median ${pct(nullTaus, 0.5).toFixed(3)}`);
console.log(`one-sided p = P(τ_null <= τ_obs) = ${p.toFixed(4)}`);
console.log(p < 0.05
  ? '=> rank instability EXCEEDS noise: H2\'s "ordering changes across models" is evidence.'
  : '=> observed instability is compatible with seed noise alone: H2 not supported at n=3 seeds.');
