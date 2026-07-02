#!/usr/bin/env node
// audit-claims.js — a drift guard between the PROSE writeup and the DATA.
//
// The results writeup (docs/crucible-results.md, README, explainer) makes load-bearing factual
// claims — "aider fails tool-recover on every local model", "pi/goose on qwen3 only look good
// because timeouts are excluded", etc. Those numbers were hand-copied once and can silently rot
// when the battery is re-run. This script recomputes each claim from the ledger and FAILS
// (exit 1) if a claim no longer holds — so a stale sentence in the docs breaks CI instead of a
// reviewer.
//
// When a claim fails: the DATA changed. Fix the DOC (and this claim) to match, or investigate the
// battery. Never "fix" it by weakening the check to whatever the number happens to be.
//
// Usage: node crucible/audit-claims.js [ledger]   (default crucible/results/battery.jsonl)
'use strict';
const fs = require('fs');
const path = require('path');
const LEDGER = process.argv[2] || path.join(__dirname, 'results', 'battery.jsonl');
if (!fs.existsSync(LEDGER)) { console.error(`ledger not found: ${LEDGER} (run crucible/bench.sh first)`); process.exit(2); }
const rows = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

// --- data helpers -------------------------------------------------------------
const sel = (a, m, task) => rows.filter(r =>
  (a == null || r.adapter === a) && (m == null || r.model === m) && (task == null || r.task === task));
const finished = rs => rs.filter(r => !r.timed_out);
const passes = rs => finished(rs).filter(r => r.result === 'passed').length;
const timeouts = rs => rs.filter(r => r.timed_out).length;
// Goodput = mean gated Score over ALL attempts (timeouts are score-0 rows already in the ledger).
const goodput = rs => rs.length ? rs.reduce((s, r) => s + (r.score ?? 0), 0) / rs.length : 0;
// Score|fin = mean gated Score over finished runs only (the old, conditional headline).
const condScore = rs => { const f = finished(rs); return f.length ? f.reduce((s, r) => s + (r.score ?? 0), 0) / f.length : 0; };
const relPct = rs => rs.length ? 100 * finished(rs).length / rs.length : 0;
const LOCAL = ['deepseek-r1:1.5b', 'qwen3:8b', 'deepseek-r1:8b'];

// --- the claims (each mirrors a sentence in the writeup) -----------------------
const claims = [];
const claim = (desc, ok, actual) => claims.push({ desc, ok: !!ok, actual });

// 1. The tool-recover contradiction the writeup used to get wrong:
//    aider must NOT be described as "passing" tool-recover — it passes 0 on every local model.
const aiderTR = LOCAL.reduce((s, m) => s + passes(sel('aider', m, 'tool-recover')), 0);
claim('aider passes tool-recover on 0 local-model cells (do NOT claim aider passes T1)',
  aiderTR === 0, `${aiderTR} passes`);

// 2. The only LOCAL harnesses that pass tool-recover at all are pi/goose/hermes on qwen3.
const localTRwinners = [...new Set(rows
  .filter(r => r.task === 'tool-recover' && !r.timed_out && r.result === 'passed' && LOCAL.includes(r.model))
  .map(r => `${r.adapter}@${r.model}`))].sort();
const expectedTRwinners = ['goose@qwen3:8b', 'hermes@qwen3:8b', 'pi@qwen3:8b'];
claim('local tool-recover passers are exactly {pi,goose,hermes}@qwen3:8b',
  JSON.stringify(localTRwinners) === JSON.stringify(expectedTRwinners), localTRwinners.join(', ') || '(none)');

// 3. claude (full harness) passes tool-recover.
const claudeTR = passes(sel('claude', 'claude-opus-4-8', 'tool-recover'));
claim('claude (full harness) passes tool-recover (≥1)', claudeTR >= 1, `${claudeTR} passes`);

// 4. Timeout-exclusion bias is real and large: on qwen3, pi and goose look great on Score|fin but
//    their Goodput collapses because they time out. The honest (goodput) view must reorder them
//    BELOW the reliable harnesses (ollama).
for (const a of ['pi', 'goose']) {
  const rs = sel(a, 'qwen3:8b');
  const drop = condScore(rs) - goodput(rs);
  claim(`${a}@qwen3: Goodput << Score|fin (timeout bias ≥0.2)`, drop >= 0.2,
    `Score|fin=${condScore(rs).toFixed(2)} Goodput=${goodput(rs).toFixed(2)} Rel=${relPct(rs).toFixed(0)}% Δ=${drop.toFixed(2)}`);
}

// 5. On qwen3 by GOODPUT, a reliable harness (ollama) must out-rank the flaky goose.
const ollamaQ = goodput(sel('ollama', 'qwen3:8b'));
const gooseQ = goodput(sel('goose', 'qwen3:8b'));
claim('qwen3 goodput: ollama out-ranks goose (reliability matters)', ollamaQ > gooseQ,
  `ollama=${ollamaQ.toFixed(2)} goose=${gooseQ.toFixed(2)}`);

// 6. aider has cross-model reach (nonzero goodput on all three local models); pi/goose/hermes do not.
const aiderReach = LOCAL.every(m => goodput(sel('aider', m)) > 0.05);
claim('aider has reach: goodput>0.05 on all three local models', aiderReach,
  LOCAL.map(m => `${m}:${goodput(sel('aider', m)).toFixed(2)}`).join(' '));

// 7. codex is a structural zero across every finished local cell.
const codexPass = LOCAL.reduce((s, m) => s + passes(sel('codex', m)), 0);
claim('codex passes 0 finished local cells (structural protocol zero)', codexPass === 0, `${codexPass} passes`);

// --- report -------------------------------------------------------------------
let failed = 0;
console.log(`\nCrucible claims audit — ${rows.length} runs from ${path.relative(path.join(__dirname, '..'), LEDGER)}\n`);
for (const c of claims) {
  const tag = c.ok ? '  ok  ' : ' FAIL ';
  if (!c.ok) failed++;
  console.log(`[${tag}] ${c.desc}\n           actual: ${c.actual}`);
}
console.log('');
if (failed) {
  console.error(`✗ ${failed}/${claims.length} claim(s) drifted from the ledger — the DOCS are now stale.`);
  console.error(`  Update docs/crucible-results.md (and this file) to match the data, or investigate the battery.`);
  process.exit(1);
}
console.log(`✓ all ${claims.length} documented claims still hold against the ledger.`);
