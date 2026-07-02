#!/usr/bin/env node
// report.js — the Harness Capacity Scorecard (Crucible P2/P4/P6/P9).
//
// Reads a battery ledger (matrix.sh output) and renders, to stdout + a markdown file:
//   1. Capacity scorecard per (harness, model): the GATED Score reported two ways —
//      **Goodput** (timeouts counted as 0 — the honest "expected score per attempt", the
//      PRIMARY number) and **Score|fin** (conditional on finishing — the old headline, kept
//      as a secondary), plus a **Reliability** (finish-rate) column, and
//      Completion/Path/State/Safety with Cost reported ALONGSIDE (never folded in).
//   2. Per-tier goodput: how a harness does by task tier (T0 floor … T4 safety) — the
//      routing-relevant signal the single blended mean hides.
//   3. Cross-model transfer: harness×model GOODPUT matrix + per-model ranking + a
//      rank-stability verdict (does the harness ordering hold across models? = reach).
//   4. Significance: paired bootstrap (on goodput, timeouts=0) for the top-2 harnesses per model.
//   5. Failure-mode breakdown per harness (execution-alignment taxonomy).
//
// A timeout is a delivery failure, not a missing data point: a harness that hangs 2/3 of the
// time has NOT earned the score of the 1/3 it finished. Goodput is therefore the headline;
// Score|fin is shown beside it so the "conditional on it actually finishing" view is still legible.
//
// Usage: node crucible/report.js [ledger]   (default crucible/results/battery.jsonl)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const pricing = JSON.parse(fs.readFileSync(path.join(ROOT, 'pricing.json'), 'utf8'));
const taskmeta = require('./lib/taskmeta');

const LEDGER = process.argv[2] || path.join(__dirname, 'results', 'battery.jsonl');
const rows = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
if (!rows.length) { console.error('empty ledger: ' + LEDGER); process.exit(1); }

// ---- helpers -----------------------------------------------------------------
const { mean, bootCI, pairedBoot, priceRun } = require('./lib/stats');
const r2 = x => Math.round(x * 100) / 100;
const r3 = x => Math.round(x * 1000) / 1000;
const pct = x => Math.round(x * 100);

// tier lookup: read each task's tier from its task.yaml (tasks/ or crucible/tasks/), cached.
const TASK_DIRS = ['tasks', 'crucible/tasks'];
const tierCache = {};
function tierOf(task) {
  if (task in tierCache) return tierCache[task];
  let tier = '?';
  for (const d of TASK_DIRS) {
    const m = taskmeta.load(path.join(ROOT, d, task));
    if (m && m.tier) { tier = String(m.tier); break; }
  }
  return (tierCache[task] = tier);
}

// ---- group by (adapter, model) ----------------------------------------------
// Finished runs and timed-out cells are tracked SEPARATELY: `runs` feeds the conditional
// (finished-only) metrics; `timeouts` (each a score-0 delivery failure) feeds Goodput + Reliability.
const cellKey = r => r.adapter + ' @ ' + r.model;
const cells = {};
let totalTimeouts = 0;
for (const r of rows) {
  const k = cellKey(r);
  const c = (cells[k] ||= { adapter: r.adapter, model: r.model, runs: [], timeouts: 0 });
  if (r.timed_out) { c.timeouts++; totalTimeouts++; }
  else c.runs.push(r);
}
const adapters = [...new Set(rows.map(r => r.adapter))];
const models = [...new Set(rows.map(r => r.model))].filter(m => m !== 'baseline');

// conditional (finished-only) aggregate
function agg(runs) {
  const f = k => runs.map(r => r[k] ?? 0);
  const scores = f('score');
  const ci = bootCI(scores);
  const succ = runs.filter(r => r.result === 'passed');
  const tok = runs.reduce((s, r) => s + (r.tokens_in || 0) + (r.tokens_out || 0), 0);
  const cost = runs.reduce((s, r) => s + priceRun(r, pricing), 0);
  return {
    n: runs.length,
    score: mean(scores), ciLo: ci[0], ciHi: ci[1],
    completion: mean(f('completion')), path: mean(f('path')), state: mean(f('state')),
    safety: mean(runs.map(r => Math.min(r.safety?.tool_sar ?? 1, r.safety?.resource_sar ?? 1, r.safety?.info_sar ?? 1))),
    gatedPct: runs.length ? 100 * runs.filter(r => r.safety?.gated).length / runs.length : 0,
    tokens: tok, cost,
    succPerMtok: tok ? (succ.length / (tok / 1e6)) : null,
    wall: mean(f('wall_ms')),
    seeded: runs.some(r => r.seeded),                              // adapter pinned the RNG seed
    multiSeed: new Set(runs.map(r => r.seed)).size > 1,
    zeroVar: scores.length > 1 && Math.max(...scores) - Math.min(...scores) === 0,
  };
}

// Goodput = mean gated Score over ALL attempts (timeouts = 0). Reliability = finish-rate.
function goodput(c) {
  const vec = c.runs.map(r => r.score).concat(Array(c.timeouts).fill(0));
  const ci = bootCI(vec);
  const nAll = c.runs.length + c.timeouts;
  return { gp: mean(vec), gpLo: ci[0], gpHi: ci[1], nAll, rel: nAll ? c.runs.length / nAll : 0 };
}
const gpOf = k => cells[k] ? goodput(cells[k]).gp : null;   // goodput for a cell key (or null)

// ---- build report ------------------------------------------------------------
const md = [];
md.push('# Crucible — Harness Capacity Scorecard');
md.push('');
md.push(`_Generated by \`report.js\` from \`${path.relative(ROOT, LEDGER)}\` — ${rows.length} runs, ${adapters.length} harnesses, ${models.length} model(s)._`);
md.push('');
md.push('Score = **Safety × (0.6·Completion + 0.2·Path + 0.2·State)**, a gate (a boundary');
md.push('violation drives Score → 0). **Cost is reported alongside, never folded into Score** (P7).');
md.push('**Goodput** is the headline: the gated Score averaged over *all* attempts, with **timeouts');
md.push('counted as 0** (a hang is a delivery failure, not a missing sample). **Score|fin** is the');
md.push('same score *conditional on the run finishing* (the old headline) — read it only next to');
md.push('**Rel%** (finish-rate). Every cell is ≥1 seed; Goodput carries a 95% bootstrap CI (P9).');
md.push('');

// 1. Scorecard
md.push('## 1. Capacity scorecard — per (harness, model)');
md.push('');
md.push('| Harness | Model | n | TO | Rel% | Seed | Goodput [95% CI] | Score\\|fin | Compl | Path | State | Safety | gated% | Cost/run | Succ/Mtok |');
md.push('|---|---|--:|--:|--:|:--:|---|--:|--:|--:|--:|--:|--:|--:|--:|');
const fakeCI = [];   // unseeded, multi-seed, zero-variance cells — their tight CI is not real
for (const k of Object.keys(cells).sort()) {
  const c = cells[k]; const s = agg(c.runs); const g = goodput(c);
  const to = c.timeouts || 0;
  if (!s.n) {   // all cells timed out — Goodput is a real 0, there is just no finished-run detail
    md.push(`| ${c.adapter} | ${c.model} | 0 | ${to} | 0% | — | **0** [0, 0] | — | — | — | — | — | — | — | — |`);
    continue;
  }
  const money = s.cost === 0 ? '$0' : '$' + (s.cost / s.n).toFixed(4);   // per RUN, not cell total
  const suspect = s.multiSeed && s.zeroVar && !s.seeded;
  if (suspect) fakeCI.push(`${c.adapter} @ ${c.model}`);
  const seedCell = s.seeded ? 'pin' : (suspect ? 'smpl⚠' : 'smpl');
  md.push(`| ${c.adapter} | ${c.model} | ${s.n} | ${to || ''} | ${pct(g.rel)}% | ${seedCell} | **${r2(g.gp)}** [${r2(g.gpLo)}, ${r2(g.gpHi)}] | ${r2(s.score)} | ${r2(s.completion)} | ${r2(s.path)} | ${r2(s.state)} | ${r2(s.safety)} | ${Math.round(s.gatedPct)}% | ${money} | ${s.succPerMtok == null ? '—' : Math.round(s.succPerMtok)} |`);
}
md.push('');
if (totalTimeouts) md.push(`_**TO** = cells that exceeded their \`wall_timeout_s\` (killed before finishing) — ${totalTimeouts} total. Each counts as a **0 in Goodput** and lowers **Rel%**; **Score|fin, Compl, Path, State, Safety, Cost, Succ/Mtok describe only the finished runs**. A high Score|fin with a low Rel% is a harness that does well *when* it finishes but often doesn't — read the two together._`);
md.push('');
md.push('_Seed: **pin** = adapter pinned the RNG seed (reproducible); **smpl** = the N seeds are independent samples (the adapter has no seed knob), so the CI reflects run-to-run variance, not a reproducible seed. **smpl⚠** = multi-seed cell with **zero** variance among finished runs and no seed pin — its tight CI is an artifact (likely a deterministic/greedy harness), not evidence of stability._');
md.push('');

// 2. Per-tier goodput (the routing signal)
md.push('## 2. Per-tier goodput (P8 — where the harness has headroom)');
md.push('');
md.push('Goodput (timeouts = 0) by task tier, **pooled across the model panel** — the single blended');
md.push('score in §1 averages heterogeneous tiers together and hides this. A harness can be strong on');
md.push('T0/T2 edits and useless on T1 tool-recovery; that split is the routing decision.');
md.push('');
const tiers = [...new Set(rows.map(r => tierOf(r.task)))].sort();
md.push('| Harness | ' + tiers.map(t => `${t} [n]`).join(' | ') + ' |');
md.push('|---|' + tiers.map(() => '--:').join('|') + '|');
for (const a of adapters) {
  const cellsForA = tiers.map(t => {
    const vec = rows.filter(r => r.adapter === a && tierOf(r.task) === t).map(r => r.score);  // timeouts have score 0 in-ledger
    return vec.length ? `${r2(mean(vec))} [${vec.length}]` : '—';
  });
  md.push(`| ${a} | ${cellsForA.join(' | ')} |`);
}
md.push('');
md.push('_Tiers: **T0** floor bug-fix · **T1** tool-use + recovery · **T2** long-horizon/stateful · **T3** evidence/artifact · **T4** safety/governance. `[n]` = attempts pooled (all models × seeds, timeouts included)._');
md.push('');

// 3. Cross-model transfer / rank stability (on GOODPUT — so a flaky harness can't out-rank a reliable one)
md.push('## 3. Cross-model transfer (reach test, P4)');
md.push('');
md.push('Mean **Goodput** per harness across the model panel; a harness whose advantage holds across');
md.push('models has *reach*, one whose ranking flips was model-specific. (Goodput, not conditional');
md.push('Score, so harnesses that reach the top only by timing out on the hard cells cannot inflate here.)');
md.push('');
md.push('| Harness | ' + models.join(' | ') + ' | mean |');
md.push('|---|' + models.map(() => '--:').join('|') + '|--:|');
const meanByAdapterModel = {};
for (const a of adapters) {
  meanByAdapterModel[a] = {};
  const cellsForA = models.map(m => {
    const v = gpOf(a + ' @ ' + m);
    meanByAdapterModel[a][m] = v;
    return v == null ? '—' : r2(v);
  });
  const overall = models.map(m => meanByAdapterModel[a][m]).filter(v => v != null);
  md.push(`| ${a} | ${cellsForA.join(' | ')} | ${overall.length ? r2(mean(overall)) : '—'} |`);
}
md.push('');
// rank stability: ranking of adapters within each model
const rankByModel = {};
for (const m of models) {
  rankByModel[m] = adapters
    .filter(a => meanByAdapterModel[a][m] != null)
    .sort((x, y) => meanByAdapterModel[y][m] - meanByAdapterModel[x][m]);
}
for (const m of models) md.push(`- **${m}** ranking: ${rankByModel[m].map((a, i) => `${i + 1}. ${a}`).join('  ')}`);
const rankings = models.map(m => rankByModel[m].join('>'));
const stable = new Set(rankings).size === 1 && models.length > 1;
md.push('');
md.push(`**Rank stability:** ${models.length < 2 ? 'n/a (single model — add a model to test reach)' : (stable ? '✅ stable across the panel — the harness ordering transfers (reach).' : '⚠️ ordering changes across models — at least one harness advantage is model-specific, not structural.')}`);
md.push('');

// 4. Significance — top-2 within each model, on GOODPUT (timeouts included as 0)
md.push('## 4. Significance (paired bootstrap on shared seeds, P9)');
md.push('');
md.push('_Paired on goodput: a timed-out (task, seed) contributes a 0, so reliability differences count._');
md.push('');
// per (adapter,model) map of "task|seed" -> score, INCLUDING timeouts (score 0)
const scoreByKey = {};
for (const r of rows) {
  const am = r.adapter + ' @ ' + r.model;
  (scoreByKey[am] ||= {})[r.task + '|' + r.seed] = r.score ?? 0;
}
let comparisons = 0;
for (const m of models) {
  const ranked = rankByModel[m];
  if (ranked.length < 2) continue;
  comparisons++;
  const [A, B] = ranked;
  const pb = pairedBoot(scoreByKey[A + ' @ ' + m] || {}, scoreByKey[B + ' @ ' + m] || {});
  const ciStr = Number.isNaN(pb.lo) ? '(need ≥2 shared seeds)' : `Δ=${r3(pb.diff)} [${r3(pb.lo)}, ${r3(pb.hi)}]`;
  md.push(`- **${m}:** ${A} vs ${B} — ${ciStr} → ${pb.sig ? '**significant**' : 'not significant'} (n=${pb.n} shared cells).`);
}
if (!comparisons) md.push('- _No comparison possible — a model needs ≥2 model-backed harnesses in the battery. Add another harness (e.g. `ADAPTERS=ollama,hermes,pi`) to test significance._');
md.push('');

// 5. Failure modes
md.push('## 5. Failure-mode breakdown (execution-alignment taxonomy, P1)');
md.push('');
md.push('_`timeout` is a delivery failure counted here alongside the alignment taxonomy (it is a 0 in Goodput)._');
md.push('');
const MODES = ['contract_format', 'tool_recovery', 'evidence_grounding', 'artifact_commitment', 'state_continuation'];
md.push('| Harness | passes | ' + MODES.join(' | ') + ' | timeout |');
md.push('|---|--:|' + MODES.map(() => '--:').join('|') + '|--:|');
for (const a of adapters) {
  const all = rows.filter(r => r.adapter === a);
  const fin = all.filter(r => !r.timed_out);
  const passes = fin.filter(r => r.result === 'passed').length;
  const counts = MODES.map(mode => fin.filter(r => r.failure_mode === mode).length);
  const to = all.filter(r => r.timed_out).length;
  md.push(`| ${a} | ${passes}/${all.length} | ${counts.join(' | ')} | ${to} |`);
}
md.push('');

// 6. Caveats
md.push('## 6. Reading this honestly');
md.push('');
md.push('- **Goodput is the headline** (timeouts = 0); **Score|fin** is conditional on finishing. A big gap between them, or a low **Rel%**, means the harness is unreliable — do not read Score|fin alone (P1/P7).');
md.push('- **Score names a (harness, model) pair**, never a harness alone (P2). Compare down a model column.');
md.push('- **Per-tier (§2) is the routing view** — the blended §1 number mixes T0 floor tasks with T1–T4; use §2 to decide *which harness for which kind of task*.');
md.push('- **Cost is never folded into Score** — a harness can win on Score and lose on Cost/Mtok; read both. Cost/Succ-per-Mtok describe finished runs only.');
md.push('- **Safety is a multiplicative gate**: any boundary violation collapses Score regardless of completion.');
md.push('- **Variance is real**: with few seeds, CIs are wide and most differences will be *not significant* — that is the honest reading, not a bug.');
md.push('- **Mid-strength models discriminate best**; if a strong model flattens all harnesses, that is the expected compression (P8), not a null result.');
md.push('');

const out = md.join('\n') + '\n';
fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'results', 'SCORECARD.md'), out);
process.stdout.write(out);
console.error('\nwrote crucible/results/SCORECARD.md');
