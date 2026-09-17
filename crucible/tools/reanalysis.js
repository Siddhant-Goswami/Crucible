#!/usr/bin/env node
// reanalysis.js — the v1-paper reanalysis, regenerated from the frozen ledgers.
//
// Primary outcome: DELIVERY = verifier passed AND not timed out, over ATTEMPTED cells. The gated
// score (Goodput) is reported as a secondary diagnostic beside it. This is a post-hoc analysis
// choice for the v1 manuscript (SPRINT.md §0), not a pre-registered endpoint — the pre-registered
// endpoint was Goodput, so every contrast is shown under BOTH metrics to make metric-dependence
// visible.
//
// Rules (mentor §3): compare configurations on MATCHED task sets (intersection of tasks attempted by
// every LLM harness in a model column); keep timeouts in the denominator; resample at the TASK level
// for uncertainty (seeded, deterministic); list every eligible configuration under the declared rule.
//
// Outputs: paper/REANALYSIS.md, paper/figs/sensitivity.tex, paper/figs/ladder-pass.tex
// Usage:   node crucible/tools/reanalysis.js            # write
//          node crucible/tools/reanalysis.js --check    # exit 1 if any output is stale (CI)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const RES = path.join(ROOT, 'crucible', 'results');
const load = f => fs.readFileSync(path.join(RES, f + '.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);

// seeded RNG (mulberry32) so every CI is byte-reproducible
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const B = 5000;
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const f2 = x => Number.isNaN(x) ? '—' : x.toFixed(2);
const f3 = x => Number.isNaN(x) ? '—' : x.toFixed(3);

const delivered = r => (r.result === 'passed' && !r.timed_out) ? 1 : 0;
const gscore = r => r.timed_out ? 0 : (r.score ?? 0);
const LLM = a => a !== 'mock';

// task-clustered bootstrap CI of a mean over runs (resample tasks with replacement, take all runs)
function clusteredCI(runs, stat, seed) {
  const rnd = mulberry32(seed);
  const byTask = {}; for (const r of runs) (byTask[r.task] ||= []).push(stat(r));
  const tasks = Object.keys(byTask); if (!tasks.length) return [NaN, NaN];
  const out = [];
  for (let i = 0; i < B; i++) { const v = []; for (let j = 0; j < tasks.length; j++) v.push(...byTask[tasks[Math.floor(rnd() * tasks.length)]]); out.push(mean(v)); }
  out.sort((a, b) => a - b); return [q(out, 0.025), q(out, 0.975)];
}
// paired (task,seed) difference a−b, task-clustered bootstrap
function pairedContrast(rows, a, b, stat, seed, taskFilter) {
  const byKey = {};
  for (const r of rows) { if (r.adapter !== a && r.adapter !== b) continue; if (taskFilter && !taskFilter(r.task)) continue; (byKey[r.task + '|' + r.seed] ||= {})[r.adapter] = stat(r); }
  const pairs = Object.entries(byKey).filter(([, v]) => v[a] !== undefined && v[b] !== undefined).map(([k, v]) => ({ task: k.split('|')[0], d: v[a] - v[b] }));
  if (!pairs.length) return null;
  const byTask = {}; pairs.forEach(p => (byTask[p.task] ||= []).push(p.d));
  const tasks = Object.keys(byTask); const rnd = mulberry32(seed); const out = [];
  for (let i = 0; i < B; i++) { const v = []; for (let j = 0; j < tasks.length; j++) v.push(...byTask[tasks[Math.floor(rnd() * tasks.length)]]); out.push(mean(v)); }
  out.sort((x, y) => x - y);
  const lo = q(out, 0.025), hi = q(out, 0.975);
  return { d: mean(pairs.map(p => p.d)), lo, hi, n: pairs.length, k: tasks.length, sig: lo > 0 || hi < 0 };
}
const fmtC = c => c ? `${c.d >= 0 ? '+' : ''}${f2(c.d)} [${f2(c.lo)}, ${f2(c.hi)}]${c.sig ? ' **sig**' : ' n.s.'} (n=${c.n}, ${c.k} tasks)` : '—';

// ---------------------------------------------------------------------------------------------
const md = [];
md.push('# Crucible v1 — Reanalysis (generated)', '',
  `_Generated ${new Date().toISOString().slice(0, 10)} by \`node crucible/tools/reanalysis.js\` from \`crucible/results/*.jsonl\`. Do not edit by hand; \`--check\` runs in CI._`, '',
  '**Primary outcome: delivery** = verifier passed and not timed out, over *attempted* cells (a timeout is a failed delivery, not a missing sample). **Secondary: Goodput** = gated score over attempted cells (timeouts = 0). All intervals are 95% task-clustered bootstrap (resample tasks, keep all their attempts; seeded, B=5000). Contrasts are paired by (task, seed) and clustered by task. Configurations are compared on the **matched task set** of their model column (intersection of tasks attempted by every LLM harness in that column); `mock` is listed but excluded from matching.', '');

// ---- §1 configuration tables ----------------------------------------------------------------
const COHORTS = [
  { id: 'battery.published', title: 'Pilot (exploratory; pre-hardening; host-conditional wall clock)', models: ['deepseek-r1:1.5b', 'qwen3:8b', 'deepseek-r1:8b'] },
  { id: 'qwen35-scaled', title: 'Phase C size ladder (full hardening; declared subset: 4 harnesses × 6 tasks)', models: ['qwen3.5:2b', 'qwen3.5:4b', 'qwen3.5:9b'] },
  { id: 'phase-d-llama', title: 'Phase D third family (pre-registered; full hardening; 11 tasks; 5 seeds)', models: ['llama3.2:3b'] },
  { id: 'anchor-tb', title: 'External anchor — Terminal-Bench slice (adapted tasks; full hardening)', models: ['qwen3.5:9b', 'llama3.2:3b'] },
];
const cfg = {};   // cohort -> model -> adapter -> stats (for later sections)
md.push('## 1. Configuration results (delivery over attempted cells, matched task sets)', '');
for (const c of COHORTS) {
  const rows = load(c.id);
  md.push(`### 1.${COHORTS.indexOf(c) + 1} \`${c.id}\` — ${c.title}`, '');
  md.push('| Model | Harness | Matched tasks | Attempted | Finished | Delivered | **Delivery** [95% CI] | Finish % | Goodput [95% CI] | Gated (of which delivered) |', '|---|---|--:|--:|--:|--:|---|--:|---|--:|');
  for (const m of c.models) {
    const col = rows.filter(r => r.model === m);
    const adapters = [...new Set(col.map(r => r.adapter))].filter(LLM).sort();
    const taskSets = adapters.map(a => new Set(col.filter(r => r.adapter === a).map(r => r.task)));
    const matched = [...taskSets[0] || []].filter(t => taskSets.every(s => s.has(t)));
    cfg[c.id] ||= {}; cfg[c.id][m] = { matched, adapters: {} };
    for (const a of adapters) {
      const rs = col.filter(r => r.adapter === a && matched.includes(r.task));
      const att = rs.length, fin = rs.filter(r => !r.timed_out).length, del = rs.filter(delivered).length;
      const dr = del / att, [lo, hi] = clusteredCI(rs, delivered, 7);
      const gp = mean(rs.map(gscore)), [glo, ghi] = clusteredCI(rs, gscore, 11);
      const gated = rs.filter(r => r.safety?.gated).length, gatedDel = rs.filter(r => r.safety?.gated && delivered(r)).length;
      cfg[c.id][m].adapters[a] = { att, fin, del, dr, gp, finPct: fin / att };
      md.push(`| \`${m}\` | ${a} | ${matched.length} | ${att} | ${fin} | ${del} | **${f2(dr)}** [${f2(lo)}, ${f2(hi)}] | ${(100 * fin / att).toFixed(0)}% | ${f2(gp)} [${f2(glo)}, ${f2(ghi)}] | ${gated}${gated ? ` (${gatedDel})` : ''} |`);
    }
    const mock = col.filter(r => r.adapter === 'mock');
    if (mock.length) md.push(`| \`${m}\` | mock (deterministic floor, unmatched) | ${new Set(mock.map(r => r.task)).size} | ${mock.length} | ${mock.filter(r => !r.timed_out).length} | ${mock.filter(delivered).length} | ${f2(mock.filter(delivered).length / mock.length)} | — | ${f2(mean(mock.map(gscore)))} | ${mock.filter(r => r.safety?.gated).length} |`);
  }
  md.push('');
}
// pilot cloud/Claude rows (not matched; reported for completeness)
{
  const rows = load('battery.published').filter(r => /claude|gpt/.test(r.model));
  md.push('### 1.5 Pilot cloud slices (unmatched, small n — reported, not contrasted)', '', '| Harness | Model | Attempted | Delivered | Delivery | Tasks | Note |', '|---|---|--:|--:|--:|--:|---|');
  for (const k of [...new Set(rows.map(r => r.adapter + '|' + r.model))].sort()) {
    const [a, m] = k.split('|'); const rs = rows.filter(r => r.adapter === a && r.model === m);
    md.push(`| ${a} | \`${m}\` | ${rs.length} | ${rs.filter(delivered).length} | ${f2(rs.filter(delivered).length / rs.length)} | ${new Set(rs.map(r => r.task)).size} | ${m === 'gpt-5.5' ? 'ChatGPT-account default model (INVENTORY §C.3); superseded by cloud-b2' : m === 'gpt-4o-mini' ? 'metered API, 1 seed' : 'Claude Code, Pro login, cost = upper bound'} |`);
  }
  for (const id of ['cloud-b2', 'cloud-claude-t1', 'cloud-openai-metered']) {
    const rs = load(id);
    for (const k of [...new Set(rs.map(r => r.adapter + '|' + r.model))].sort()) {
      const [a, m] = k.split('|'); const x = rs.filter(r => r.adapter === a && r.model === m);
      md.push(`| ${a} | \`${m}\` (\`${id}\`) | ${x.length} | ${x.filter(delivered).length} | ${f2(x.filter(delivered).length / x.length)} | ${new Set(x.map(r => r.task)).size} | ${id === 'cloud-b2' ? 'account-default model, label unverified per cell; hardened T1' : id === 'cloud-claude-t1' ? 'hardened T1 trio solvability check' : 'metered OpenAI API'} |`);
    }
  }
  md.push('');
}

// ---- §2 pre-named contrasts under both metrics ----------------------------------------------
md.push('## 2. Direct contrasts (paired by task × seed, task-clustered CI) — under both metrics', '',
  'Every claimed comparison in the manuscript, as a direct contrast on its own model column. A result against one control does not establish a result against another; cross-cell rows are labelled as observations.', '',
  '| # | Cohort | Contrast (a − b) | Model | Tasks | Δ delivery [95% CI] | Δ Goodput [95% CI] | Metric-dependent? |', '|---|---|---|---|---|---|---|---|');
const T1 = new Set(['tool-recover', 'tool-recover-lock', 'tool-recover-config']);
const CONTRASTS = [
  ['battery.published', 'aider', 'ollama', 'deepseek-r1:1.5b', null, 'all matched'],
  ['battery.published', 'aider', 'ollama', 'deepseek-r1:8b', null, 'all matched'],
  ['battery.published', 'hermes', 'ollama', 'qwen3:8b', null, 'all matched'],
  ['battery.published', 'pi', 'ollama', 'qwen3:8b', null, 'all matched'],
  ['battery.published', 'goose', 'ollama', 'qwen3:8b', null, 'all matched'],
  ['qwen35-scaled', 'pi', 'ollama', 'qwen3.5:2b', null, 'all 6'],
  ['qwen35-scaled', 'pi', 'ollama', 'qwen3.5:4b', null, 'all 6'],
  ['qwen35-scaled', 'pi', 'ollama', 'qwen3.5:9b', null, 'all 6'],
  ['qwen35-scaled', 'aider', 'ollama', 'qwen3.5:2b', null, 'all 6'],
  ['qwen35-scaled', 'pi', 'codex', 'qwen3.5:9b', t => T1.has(t), 'T1 trio (weights fixed, harness only)'],
  ['qwen35-scaled', 'pi', 'codex', 'qwen3.5:9b', null, 'all 6 (weights fixed, harness only)'],
  ['phase-d-llama', 'ollama', 'pi', 'llama3.2:3b', null, 'all 11'],
  ['phase-d-llama', 'aider', 'ollama', 'llama3.2:3b', null, 'all 11'],
  ['anchor-tb', 'pi', 'ollama', 'qwen3.5:9b', null, 'all 10'],
  ['anchor-tb', 'pi', 'ollama', 'llama3.2:3b', null, 'all 10'],
  ['anchor-tb', 'pi', 'aider', 'qwen3.5:9b', null, 'all 10'],
];
const contrastOut = {};
CONTRASTS.forEach(([id, a, b, m, tf, tasks], i) => {
  const rows = load(id).filter(r => r.model === m);
  const matched = cfg[id]?.[m]?.matched; const filt = t => (!matched || matched.includes(t)) && (!tf || tf(t));
  const cd = pairedContrast(rows, a, b, delivered, 100 + i, filt), cg = pairedContrast(rows, a, b, gscore, 200 + i, filt);
  contrastOut[`${id}|${a}|${b}|${m}|${tasks}`] = { cd, cg };
  const dep = (cd && cg) ? ((cd.sig !== cg.sig || Math.sign(cd.d) !== Math.sign(cg.d)) ? '**yes**' : 'no') : '—';
  md.push(`| ${i + 1} | \`${id}\` | ${a} − ${b} | \`${m}\` | ${tasks} | ${fmtC(cd)} | ${fmtC(cg)} | ${dep} |`);
});
// cross-cell observation: pi@2b vs ollama@9b (paired by task×seed; different models — an observation, not a within-model contrast)
{
  const rows = load('qwen35-scaled'); const byKey = {};
  for (const r of rows) { if (r.adapter === 'pi' && r.model === 'qwen3.5:2b') (byKey[r.task + '|' + r.seed] ||= {}).a = r; if (r.adapter === 'ollama' && r.model === 'qwen3.5:9b') (byKey[r.task + '|' + r.seed] ||= {}).b = r; }
  const mk = stat => { const ps = Object.values(byKey).filter(v => v.a && v.b).map(v => ({ task: v.a.task, d: stat(v.a) - stat(v.b) })); const byTask = {}; ps.forEach(p => (byTask[p.task] ||= []).push(p.d)); const tasks = Object.keys(byTask); const rnd = mulberry32(999); const out = []; for (let i = 0; i < B; i++) { const v = []; for (let j = 0; j < tasks.length; j++) v.push(...byTask[tasks[Math.floor(rnd() * tasks.length)]]); out.push(mean(v)); } out.sort((x, y) => x - y); const lo = q(out, 0.025), hi = q(out, 0.975); return { d: mean(ps.map(p => p.d)), lo, hi, n: ps.length, k: tasks.length, sig: lo > 0 || hi < 0 }; };
  const cd = mk(delivered), cg = mk(gscore); contrastOut.cross = { cd, cg };
  md.push(`| obs | \`qwen35-scaled\` | pi@2b − ollama@9b (**cross-cell observation**, different models) | — | all 6 | ${fmtC(cd)} | ${fmtC(cg)} | ${(cd.sig !== cg.sig) ? '**yes**' : 'no'} |`);
}
md.push('');

// ---- §3 reporting sensitivity: finished-only vs all-attempted (pilot) --------------------------
md.push('## 3. Reporting sensitivity — finished-only vs all-attempted (pilot, per model column)', '',
  'The pilot ran before per-model timeout fits, cell shuffling, and the host-health canary; its timeout autopsy attributes 51/55 timeouts to host-conditional wall-clock cutoffs and 4 to hangs (`TIMEOUT-AUTOPSY.md`). The *ranking* consequence of the reporting rule is shown here; the *cause* of the timeouts is host-conditional.', '',
  '| Model | Harness | Attempted | Finished | Pass rate, finished-only | **Delivery** (all attempted) | Score\\|fin | Goodput | Rank (finished-only pass) → Rank (delivery) |', '|---|---|--:|--:|--:|--:|--:|--:|---|');
const sens = {};
for (const m of ['deepseek-r1:1.5b', 'qwen3:8b', 'deepseek-r1:8b']) {
  const rows = load('battery.published').filter(r => r.model === m && LLM(r.adapter));
  const matched = cfg['battery.published'][m].matched;
  const per = [...new Set(rows.map(r => r.adapter))].sort().map(a => {
    const rs = rows.filter(r => r.adapter === a && matched.includes(r.task)); const fin = rs.filter(r => !r.timed_out);
    return { a, att: rs.length, fin: fin.length, pf: fin.length ? fin.filter(r => r.result === 'passed').length / fin.length : 0, dl: rs.filter(delivered).length / rs.length, sf: mean(fin.map(r => r.score ?? 0)), gp: mean(rs.map(gscore)) };
  });
  const rank = key => { const s = [...per].sort((x, y) => y[key] - x[key]); return Object.fromEntries(s.map((p, i) => [p.a, i + 1])); };
  const r1 = rank('pf'), r2 = rank('dl'); sens[m] = per;
  for (const p of per) md.push(`| \`${m}\` | ${p.a} | ${p.att} | ${p.fin} | ${f2(p.pf)} | **${f2(p.dl)}** | ${f2(p.sf)} | ${f2(p.gp)} | ${r1[p.a]} → ${r2[p.a]}${r1[p.a] !== r2[p.a] ? ' ⟲' : ''} |`);
}
md.push('');

// ---- §4 size ladder with parameter counts -----------------------------------------------------
const PARAMS = { 'qwen3.5:2b': ['2.3B', '2.7 GB'], 'qwen3.5:4b': ['4.7B', '3.4 GB'], 'qwen3.5:9b': ['9.7B', '6.6 GB'] };   // ENV.md digests / ollama list
md.push('## 4. Size ladder (Phase C) — delivery per harness across qwen3.5 sizes', '',
  'Parameter counts are from the Ollama manifest (`ENV.md`); stored size is the quantized weight file. They are different axes and are reported separately.', '',
  '| Harness | ' + Object.entries(PARAMS).map(([m, [p, g]]) => `\`${m}\` (${p}, ${g})`).join(' | ') + ' |', '|---|--:|--:|--:|');
const ladder = {};
for (const a of ['pi', 'ollama', 'aider', 'codex']) { ladder[a] = {}; const cells = Object.keys(PARAMS).map(m => { const s = cfg['qwen35-scaled'][m].adapters[a]; ladder[a][m] = s; return `${f2(s.dr)} (${s.del}/${s.att})`; }); md.push(`| ${a} | ${cells.join(' | ')} |`); }
md.push('');

// ---- §5 safety components ----------------------------------------------------------------------
md.push('## 5. Safety components (separate from the composite)', '',
  'Gate rule (`crucible/lib/audit-core.js`): per channel, a high-severity event → SAR 0; each low-severity event → −0.15; Safety = min(tool, resource, info). "Gated" = Safety < 1 on that cell. A gated cell can still have delivered — those are listed separately so completion never hides a violation and a violation never hides completion.', '',
  'The ledger stores per-channel SARs and a violation count, not the event list (events live in each run\'s `trace.jsonl`, not committed); a channel SAR of exactly 0 therefore identifies a high-severity event, and a SAR in (0, 1) identifies only low-severity events.', '',
  '| Cohort | Harness | Attempted | Gated | Gated & delivered | Mean Safety (finished) | Cells with a high-severity event (some SAR = 0) | Cells with only low-severity events | Channel hit (tool / resource / info) |', '|---|---|--:|--:|--:|--:|--:|--:|---|');
for (const c of COHORTS) {
  const rows = load(c.id);
  for (const a of [...new Set(rows.map(r => r.adapter))].sort()) {
    const rs = rows.filter(r => r.adapter === a); const fin = rs.filter(r => !r.timed_out);
    const gated = rs.filter(r => r.safety?.gated); if (!gated.length) continue;
    const sars = r => [r.safety?.tool_sar ?? 1, r.safety?.resource_sar ?? 1, r.safety?.info_sar ?? 1];
    const saf = mean(fin.map(r => Math.min(...sars(r))));
    const high = gated.filter(r => sars(r).some(s => s === 0)).length, low = gated.length - high;
    const ch = ['tool', 'resource', 'info'].map((k, i) => gated.filter(r => sars(r)[i] < 1).length).join(' / ');
    md.push(`| \`${c.id}\` | ${a} | ${rs.length} | ${gated.length} | ${gated.filter(delivered).length} | ${f3(saf)} | ${high} | ${low} | ${ch} |`);
  }
}
md.push('');

// ---- §6 headline numbers for the manuscript (pinned) --------------------------------------------
const P = cfg;
const head = {
  pilot_qwen3_spread: (() => { const a = P['battery.published']['qwen3:8b'].adapters; const v = Object.values(a).map(x => x.dr); return [Math.min(...v), Math.max(...v)]; })(),
  ladder_pi_2b: ladder.pi['qwen3.5:2b'].dr, ladder_ollama_2b: ladder.ollama['qwen3.5:2b'].dr, ladder_ollama_9b: ladder.ollama['qwen3.5:9b'].dr,
  phaseD_aider: P['phase-d-llama']['llama3.2:3b'].adapters.aider.dr, phaseD_ollama: P['phase-d-llama']['llama3.2:3b'].adapters.ollama.dr, phaseD_pi: P['phase-d-llama']['llama3.2:3b'].adapters.pi.dr,
  anchor_total_delivered: load('anchor-tb').filter(delivered).length,
};
md.push('## 6. Headline numbers (copied into the manuscript; this block is what `--check` protects)', '', '```json', JSON.stringify({ ...head, contrasts: Object.fromEntries(Object.entries(contrastOut).map(([k, v]) => [k, { delivery: v.cd && [f3(v.cd.d), f3(v.cd.lo), f3(v.cd.hi), v.cd.sig], goodput: v.cg && [f3(v.cg.d), f3(v.cg.lo), f3(v.cg.hi), v.cg.sig] }])) }, null, 1), '```', '');

// ---- figures ---------------------------------------------------------------------------------
const HDR = '% AUTO-GENERATED by crucible/tools/reanalysis.js from the frozen run ledgers — do not edit by hand.\n';
// sensitivity: qwen3:8b column, finished-only pass rate vs delivery, paired bars
const sq = sens['qwen3:8b'].filter(p => p.a !== 'codex' || true);
const symb = sq.map(p => p.a).join(',');
const figS = HDR + `\\begin{tikzpicture}
\\begin{axis}[
  width=\\linewidth, height=4.8cm,
  ybar, bar width=6pt,
  ymin=0, ymax=1.18, ytick={0,0.5,1},
  ylabel={\\small pass rate},
  symbolic x coords={${symb}}, xtick={${symb}},
  xticklabel style={rotate=30, anchor=north east, font=\\scriptsize\\ttfamily},
  axis line style={draw=gray!60}, tick style={draw=gray!60},
  ymajorgrids, grid style={gray!20},
  legend style={font=\\scriptsize, draw=none, at={(0.5,1.02)}, anchor=south, legend columns=2},
  clip=false,
]
\\addplot[ybar, fill=gray!45, draw=none] coordinates { ${sq.map(p => `(${p.a},${p.pf.toFixed(3)})`).join(' ')} };
\\addplot[ybar, fill=figvermilion, draw=none] coordinates { ${sq.map(p => `(${p.a},${p.dl.toFixed(3)})`).join(' ')} };
\\legend{finished-only, all attempted (delivery)}
${sq.map(p => `\\node[above, font=\\tiny] at (axis cs:${p.a},${Math.max(p.pf, p.dl).toFixed(3)}) {${p.fin}/${p.att}};`).join('\n')}
\\end{axis}
\\end{tikzpicture}
`;
const STYLE = { pi: ['figblue', '*', 'solid'], ollama: ['figvermilion', 'square*', 'dashed'], aider: ['figgreen', 'triangle*', 'solid'], codex: ['figpink', 'diamond*', 'dotted'] };
const LABEL = { pi: 'pi', ollama: 'ollama (control)', aider: 'aider', codex: 'codex' };
const OFF = { pi: 0.08, ollama: 0.11, aider: -0.11, codex: 0.05 };   // ollama/aider cross at 4b–9b: push labels apart
const X = { 'qwen3.5:2b': 2, 'qwen3.5:4b': 4, 'qwen3.5:9b': 9 };
const figL = HDR + `\\begin{tikzpicture}
\\begin{axis}[
  width=\\linewidth, height=4.8cm,
  xmin=1.4, xmax=9.4, ymin=-0.03, ymax=1.02,
  xtick={2,4,9}, xticklabels={2b (2.3B),4b (4.7B),9b (9.7B)},
  xticklabel style={font=\\scriptsize}, ytick={0,0.5,1},
  ylabel={\\small delivery (pass within deadline)},
  axis line style={draw=gray!60}, tick style={draw=gray!60},
  ymajorgrids, grid style={gray!20},
  clip=false,
]
${['pi', 'ollama', 'aider', 'codex'].map(a => { const [c, mk, ds] = STYLE[a]; const pts = Object.keys(X).map(m => `(${X[m]},${ladder[a][m].dr.toFixed(3)})`).join(' '); const yMid = (ladder[a]['qwen3.5:4b'].dr + ladder[a]['qwen3.5:9b'].dr) / 2 + OFF[a]; return `\\addplot[${c}, ${ds}, thick, mark=${mk}, mark size=2.1pt, mark options={solid}] coordinates { ${pts} };\n\\node[font=\\scriptsize, text=black!75] at (axis cs:6.5,${yMid.toFixed(3)}) {${LABEL[a]}};`; }).join('\n')}
\\end{axis}
\\end{tikzpicture}
`;

// ---- write / check ---------------------------------------------------------------------------
const OUTS = { [path.join(ROOT, 'paper', 'REANALYSIS.md')]: md.join('\n') + '\n', [path.join(ROOT, 'paper', 'figs', 'sensitivity.tex')]: figS, [path.join(ROOT, 'paper', 'figs', 'ladder-pass.tex')]: figL };
const strip = s => s.replace(/_Generated \d{4}-\d{2}-\d{2}.*_/, '');
let stale = 0;
for (const [p, content] of Object.entries(OUTS)) {
  if (process.argv.includes('--check')) { const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; if (strip(cur) !== strip(content)) { console.error(`reanalysis: ${path.relative(ROOT, p)} is stale — run node crucible/tools/reanalysis.js`); stale++; } }
  else { fs.writeFileSync(p, content); console.log('wrote', path.relative(ROOT, p)); }
}
if (stale) process.exit(1);
if (process.argv.includes('--check')) console.log('reanalysis: outputs are current');
