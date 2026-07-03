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
const taskmeta = require('./lib/taskmeta');
const ROOT = path.join(__dirname, '..');
const LEDGER = process.argv[2] || path.join(__dirname, 'results', 'battery.jsonl');
if (!fs.existsSync(LEDGER)) { console.error(`ledger not found: ${LEDGER} (run crucible/bench.sh first)`); process.exit(2); }
const rows = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

// tier lookup (from task.yaml, same source report.js uses) + best-local-harness goodput per (model, tier)
const TASK_DIRS = ['tasks', 'crucible/tasks'];
const tierOf = task => { for (const d of TASK_DIRS) { const m = taskmeta.load(path.join(ROOT, d, task)); if (m && m.tier) return String(m.tier); } return '?'; };
const bestLocalGP = (model, tier) => {
  let best = 0;
  for (const a of [...new Set(rows.map(r => r.adapter))]) {
    const rs = rows.filter(r => r.adapter === a && r.model === model && tierOf(r.task) === tier);
    if (rs.length) best = Math.max(best, rs.reduce((s, r) => s + (r.timed_out ? 0 : (r.score ?? 0)), 0) / rs.length);
  }
  return best;
};

// --- data helpers -------------------------------------------------------------
const sel = (a, m, task) => rows.filter(r =>
  (a == null || r.adapter === a) && (m == null || r.model === m) && (task == null || r.task === task));
const finished = rs => rs.filter(r => !r.timed_out);
const passes = rs => finished(rs).filter(r => r.result === 'passed').length;
const timeouts = rs => rs.filter(r => r.timed_out).length;
// Goodput = mean gated Score over ALL attempts. A timeout is a delivery failure worth 0 — enforced
// here rather than trusted from the row (matches report.js's goodput()), so a stray nonzero score on
// a timed-out row can't let this guard silently diverge from the scorecard it's meant to protect.
const goodput = rs => rs.length ? rs.reduce((s, r) => s + (r.timed_out ? 0 : (r.score ?? 0)), 0) / rs.length : 0;
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

// --- routing conclusions (§4 of the scorecard) — guard the local-vs-cloud verdicts ---
// 8. With qwen3:8b, every tier is clearable LOCALLY by some harness (best-local goodput ≥ 0.7) —
//    so the routing verdict "stay local on qwen3" holds across all tiers.
const qwenTiers = ['T0', 'T1', 'T2', 'T3', 'T4'];
const qwenClears = qwenTiers.every(t => bestLocalGP('qwen3:8b', t) >= 0.7);
claim('qwen3:8b clears every tier locally (best-local goodput ≥ 0.7) → stay-local verdict',
  qwenClears, qwenTiers.map(t => `${t}:${bestLocalGP('qwen3:8b', t).toFixed(2)}`).join(' '));

// 9. T1 tool-recovery must ESCALATE on the weak/8b reasoning models: no local harness clears 0.5.
for (const m of ['deepseek-r1:1.5b', 'deepseek-r1:8b']) {
  const gp = bestLocalGP(m, 'T1');
  claim(`${m}: T1 tool-recover needs cloud (best-local goodput < 0.5)`, gp < 0.5, `best-local=${gp.toFixed(2)}`);
}

// --- cloud slice (§6.5): the codex bookend — only assert if the cloud slice is in the ledger ---
if (finished(sel('codex', 'gpt-5.5')).length) {
  const cc = sel('codex', 'gpt-5.5'); const ccPass = passes(cc);
  // 10. codex is 0 on every LOCAL model but passes on a capable cloud model — the harness was never
  //     broken; it needed a model that can emit its tool-call protocol.
  claim('codex bookend: 0 passes on local, but ≥3/4 on cloud gpt-5.5',
    codexPass === 0 && ccPass >= 3, `local=${codexPass} cloud=${ccPass}/${finished(cc).length}`);
  // 11. Specifically it clears T1 tool-recover on cloud — the tool-required task it structurally failed locally.
  claim('codex@gpt-5.5 passes T1 tool-recover (structural 0 locally → works on a capable cloud model)',
    passes(sel('codex', 'gpt-5.5', 'tool-recover')) >= 1, `${passes(sel('codex', 'gpt-5.5', 'tool-recover'))} pass`);
}
// 12. A metered mid cloud model behind a TEXT harness still can't do tool-recovery: aider@gpt-4o-mini
//     fails T1 (needs a tool-driving harness AND a capable model), even though it passes the rest.
if (finished(sel('aider', 'gpt-4o-mini')).length) {
  const trPass = passes(sel('aider', 'gpt-4o-mini', 'tool-recover'));
  claim('aider@gpt-4o-mini fails T1 tool-recover (text harness + mid cloud model — tool-recovery needs both)',
    trPass === 0, `${trPass} pass`);
}

// --- qwen3.5 three-arm study (QWEN35-BOOKEND-NOTES.md) — asserted only if the ledgers exist ---
const loadLedger = f => {
  const p = path.join(__dirname, 'results', f);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : null;
};
const q35on = loadLedger('qwen35-pilot.jsonl');
const q35off = loadLedger('qwen35-think-off.jsonl');
const q35repl = loadLedger('qwen35-think-on-repl.jsonl');
if (q35on && q35off && q35repl) {
  const of = (rs, a) => rs.filter(r => r.adapter === a);
  const TOOLCALLERS = ['pi', 'hermes', 'goose'];
  // 13. codex @ qwen3.5:9b stays a structural 0 (12 cells) even though the model emits clean
  //     tool_calls — interface-fit binds at the harness's dialect chain, not model capability.
  claim('codex@qwen3.5:9b is a structural 0 across all 12 cells (dialect chain, H3a-local)',
    goodput(of(q35on, 'codex')) === 0 && of(q35on, 'codex').length === 12,
    `goodput=${goodput(of(q35on, 'codex')).toFixed(2)} over ${of(q35on, 'codex').length} cells`);
  // 14. pi sweeps T1 tool-recover on qwen3.5:9b in BOTH think arms — the first perfect local
  //     tool-recover sweep, where codex (same protocol class) is 0.
  const piTR = arm => of(arm, 'pi').filter(r => r.task === 'tool-recover' && !r.timed_out && r.score >= 0.9).length;
  claim('pi@qwen3.5:9b clears tool-recover 3/3 in both think arms (codex 0 on the same cells)',
    piTR(q35on) === 3 && piTR(q35off) === 3, `think-on=${piTR(q35on)}/3 think-off=${piTR(q35off)}/3`);
  // 15. The think-ON arm's timeout wall vs think-OFF: 30/36 → ≤3/36 tool-caller timeouts.
  const tcRows = arm => arm.filter(r => TOOLCALLERS.includes(r.adapter));
  claim('tool-caller timeouts: 30/36 in the think-ON arm → ≤3/36 in the think-OFF arm',
    timeouts(tcRows(q35on)) === 30 && timeouts(tcRows(q35off)) <= 3,
    `on=${timeouts(tcRows(q35on))}/36 off=${timeouts(tcRows(q35off))}/36`);
  // 16. pi @ qwen3.5:9b (think off) is the strongest local tool-calling pair measured (goodput ≥ 0.8).
  claim('pi@qwen3.5:9b think-off Goodput ≥ 0.8 (strongest local tool-calling pair)',
    goodput(of(q35off, 'pi')) >= 0.8, `goodput=${goodput(of(q35off, 'pi')).toFixed(3)}`);
  // 17. The replication slice: the very cells that were 0/3 all-timeout think-ON in arm 1 pass 3/3
  //     think-ON on a healthy host — arm-1's wall was host state, not a thinking spiral.
  claim('think-ON replication (api-migration × pi, healthy host): 3/3 finished, goodput ≥ 0.9',
    q35repl.length === 3 && timeouts(q35repl) === 0 && goodput(q35repl) >= 0.9,
    `n=${q35repl.length} TO=${timeouts(q35repl)} goodput=${goodput(q35repl).toFixed(3)}`);
  // 18. hermes @ qwen3.5:9b is 0 across both arms — a serving-context fault (constant truncated
  //     prompt), reported as config-fault provenance, NOT capability (see notes; patched slice separate).
  claim('hermes@qwen3.5:9b scores 0 in both arms (serving-context fault — do not read as capability)',
    goodput(of(q35on, 'hermes')) === 0 && goodput(of(q35off, 'hermes')) === 0,
    `on=${goodput(of(q35on, 'hermes')).toFixed(2)} off=${goodput(of(q35off, 'hermes')).toFixed(2)}`);
}

// 19. hermes patched slice (ctx16k derived tag): full engagement, ZERO timeouts, and every cell
//     ends by TOKEN-BUDGET exhaustion — the zero is harness token economics (host-independent),
//     no longer transport. Do not describe hermes@qwen3.5 as a transport failure post-fix.
const q35hfix = loadLedger('qwen35-hermes-fix.jsonl');
if (q35hfix) {
  claim('hermes patched slice: 0 passes, 0 timeouts, 12/12 budget_exhausted (token-overbudget class)',
    q35hfix.length === 12 && passes(q35hfix) === 0 && timeouts(q35hfix) === 0 &&
    q35hfix.every(r => r.budget_exhausted),
    `n=${q35hfix.length} passes=${passes(q35hfix)} TO=${timeouts(q35hfix)} ` +
    `budget_exhausted=${q35hfix.filter(r => r.budget_exhausted).length}`);
}

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
