#!/usr/bin/env node
// inventory.js — regenerate the EXPERIMENT INVENTORY for the paper from the frozen ledgers.
//
// The v1 manuscript reports numbers from seven-plus ledgers with different task sets, seed
// counts, hardening states, and inclusion rules. A reviewer needs one table that says, per
// cohort: what ran, on which tasks/models/harnesses, how many cells were attempted vs finished
// vs passed vs timed out, whether repeats were true seeds or independent samples, and which
// commit froze the ledger. This script derives all of that from the ledgers + git and rewrites
// the block between the GENERATED markers in paper/INVENTORY.md, leaving the hand-curated
// claim-to-evidence sections untouched (same managed-block pattern as loops/03's calibration).
//
// Usage: node crucible/tools/inventory.js            # rewrite paper/INVENTORY.md in place
//        node crucible/tools/inventory.js --check    # exit 1 if the generated block is stale (CI)
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const RES = path.join(ROOT, 'crucible', 'results');
const OUT = path.join(ROOT, 'paper', 'INVENTORY.md');
const BEGIN = '<!-- BEGIN GENERATED (crucible/tools/inventory.js) -->';
const END = '<!-- END GENERATED -->';

// Cohorts in the order the paper narrates them. `role` and `hardening` are curated facts that
// cannot be read off a row (they come from the phase notes / commit history and are cited there);
// everything else in the table is computed from the ledger.
const COHORTS = [
  { id: 'battery.published',   label: 'Pilot (local factorial + Claude slice)', role: 'headline scorecard (Tab. 1), timeout inversion, safety, reach', hardening: 'pre-Phase-A: no timeout fits, no canary, fixed cell order; tool-recover PRE-hardening (hand-writeable fixture)', prereg: 'exploratory' },
  { id: 'qwen35-pilot',        label: 'qwen3.5:9b three-arm — arm 1 (think default ON)', role: 'dialect-chain result; host-degradation discovery', hardening: 'no fits/canary; host ran into swap (autopsy: host-conditional)', prereg: '§5A amendment logged before run; 5A.3 prediction (codex >0) REFUTED' },
  { id: 'qwen35-think-off',    label: 'qwen3.5:9b three-arm — arm 2 (think OFF)', role: 'pi@9b Goodput 0.83; timeouts 30/36 → 3/36', hardening: 'think pinned OFF via proxy; no fits/canary', prereg: '§5A' },
  { id: 'qwen35-think-on-repl',label: 'qwen3.5:9b three-arm — arm 3 (think ON replication, healthy host)', role: 'shows arm-1 timeouts were host, not thinking', hardening: 'healthy host; 3 cells only', prereg: 'post-hoc replication' },
  { id: 'qwen35-hermes-fix',   label: 'hermes @ qwen3.5:9b patched slice', role: 'hermes serving-context fault re-run', hardening: 'context patched; think OFF', prereg: 'post-hoc' },
  { id: 'qwen35-scaled',       label: 'Phase C — qwen3.5 size ladder', role: 'Tab. 2 / Fig. (right); "harness substitutes for scale"', hardening: 'FULL: per-model timeout fits, ORDER_SEED=137 shuffle, health canary; hardened T1 trio', prereg: '§5A design; ladder subset = 4 harnesses × 6 tasks (declared rule needed)' },
  { id: 'phase-d-llama',       label: 'Phase D — llama3.2:3b third-family arm', role: 'out-of-sample reach/structural-zero confirmation', hardening: 'FULL (fit 30s, ORDER_SEED=42, canary sidecar); hardened T1 trio', prereg: 'PRE-REGISTERED (hypotheses §5.1); predictions held' },
  { id: 'anchor-tb',           label: 'External anchor — Terminal-Bench slice', role: 'OOD reproduction of orderings; underpowered', hardening: 'FULL (fits, shuffle, canary sidecar); tasks ADAPTED (hidden base64 Python oracle, paths rewritten)', prereg: 'pre-registered as mitigation; contrast n.s.' },
  { id: 'cloud-b2',            label: 'Phase B — codex @ ChatGPT-account model', role: 'cloud bookend 20/20', hardening: 'hardened tool-recover; model = ChatGPT-account default (CLI 0.137.0; resolved to gpt-5.5 in probe sessions minutes before the Jul 2 pilot cells — INVENTORY §C.3; Jul 3 cells inferred, no per-cell record; tokens unmetered)', prereg: 'exploratory demonstration' },
  { id: 'cloud-claude-t1',     label: 'Phase B — Claude Code on hardened T1 trio', role: 'T1 solvability validation', hardening: 'hardened T1; Claude Pro login (cost = cache-inflated upper bound)', prereg: 'validation, not a contrast' },
  { id: 'cloud-openai-metered',label: 'Phase B — metered OpenAI arm (aider, pi @ gpt-4o-mini)', role: 'H3a home-turf de-confound (aider 0/3 vs pi 3/3 on tool-recover)', hardening: 'metered via proxy (real $); hardened tool-recover', prereg: 'exploratory' },
  { id: 'qwen35-t0-calib',     label: 'calibration — qwen3.5 T0 timeout fits', role: 'timeout fits only (not a result cohort)', hardening: '—', prereg: 'calibration' },
  { id: 'llama-t0-calib',      label: 'calibration — llama3.2:3b T0 timeout fits', role: 'timeout fits only', hardening: '—', prereg: 'calibration' },
  { id: 'anchor-t0-calib',     label: 'calibration — anchor models T0 timeout fits', role: 'timeout fits only', hardening: '—', prereg: 'calibration' },
];

const readLedger = id => {
  const p = path.join(RES, id + '.jsonl');
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
};
const firstCommit = id => {
  try {
    const out = execSync(`git log --diff-filter=A --format='%h %ad' --date=short -- crucible/results/${id}.jsonl`, { cwd: ROOT }).toString().trim().split('\n').filter(Boolean);
    return out[out.length - 1] || '?';
  } catch { return '?'; }
};
const isCloud = m => /gpt|claude|baseline/.test(m);
const uniq = xs => [...new Set(xs)];
const pct = (n, d) => d ? (100 * n / d).toFixed(0) + '%' : '—';

function cohortRow(c) {
  const rows = readLedger(c.id);
  if (!rows) return `| \`${c.id}\` | ${c.label} | **MISSING** | | | | | | | | |`;
  const attempted = rows.length;
  const timedOut = rows.filter(r => r.timed_out).length;
  const finished = attempted - timedOut;
  const passed = rows.filter(r => !r.timed_out && r.result === 'passed').length;
  const errors = rows.filter(r => r.result === 'error').length;
  const gated = rows.filter(r => r.safety && r.safety.gated).length;
  const harnesses = uniq(rows.map(r => r.adapter)).sort();
  const models = uniq(rows.map(r => r.model)).sort();
  const tasks = uniq(rows.map(r => r.task)).sort();
  const seeds = uniq(rows.map(r => r.seed)).sort((a, b) => a - b);
  const seededAdapters = uniq(rows.filter(r => r.seeded).map(r => r.adapter)).sort();
  const think = uniq(rows.map(r => r.think === undefined ? 'n/a' : String(r.think))).join('/');
  const ts = rows.map(r => r.ts).filter(Boolean).sort();
  const span = ts.length ? `${ts[0].slice(0, 10)}${ts[ts.length - 1].slice(0, 10) !== ts[0].slice(0, 10) ? '→' + ts[ts.length - 1].slice(0, 10) : ''}` : '?';
  return [
    `\`${c.id}\``, c.label, span, `${harnesses.length}: ${harnesses.join(', ')}`, models.join(', '),
    `${tasks.length}`, `${seeds.join(',')} (true seed: ${seededAdapters.length ? seededAdapters.join(',') : 'none'}; others = independent samples)`,
    `${attempted} / ${finished} / ${passed} / ${timedOut}${errors ? ` / err ${errors}` : ''}${gated ? ` / gated ${gated}` : ''}`,
    think, firstCommit(c.id),
  ].map(s => String(s).replace(/\|/g, '\\|')).join(' | ');
}

function taskSets() {
  const lines = ['| Cohort | Tasks (n) | Task IDs |', '|---|---|---|'];
  for (const c of COHORTS) {
    const rows = readLedger(c.id); if (!rows) continue;
    const tasks = uniq(rows.map(r => r.task)).sort();
    lines.push(`| \`${c.id}\` | ${tasks.length} | ${tasks.map(t => '`' + t + '`').join(' ')} |`);
  }
  return lines.join('\n');
}

function codexCensus() {
  const lines = ['| Cohort | Local attempted | Local finished | Local passed | Models | Cloud attempted / passed (model label) |', '|---|--:|--:|--:|---|---|'];
  let tA = 0, tF = 0, tP = 0;
  for (const c of COHORTS) {
    const rows = (readLedger(c.id) || []).filter(r => r.adapter === 'codex'); if (!rows.length) continue;
    const local = rows.filter(r => !isCloud(r.model)); const cloud = rows.filter(r => isCloud(r.model));
    const a = local.length, f = local.filter(r => !r.timed_out).length, p = local.filter(r => !r.timed_out && r.result === 'passed').length;
    tA += a; tF += f; tP += p;
    lines.push(`| \`${c.id}\` | ${a} | ${f} | ${p} | ${uniq(local.map(r => r.model)).join(', ') || '—'} | ${cloud.length ? `${cloud.length} / ${cloud.filter(r => r.result === 'passed').length} (${uniq(cloud.map(r => r.model)).join(',')})` : '—'} |`);
  }
  lines.push(`| **all local cohorts** | **${tA}** | **${tF}** | **${tP}** | | |`);
  return lines.join('\n');
}

function failureRemap() {
  // Mentor's five categories + uncertain, derived by rule from ledger fields. The ledger's own
  // `failure_mode` is an OUTCOME taxonomy (artifact_commitment lumps "no model call" with "model
  // answered, harness couldn't apply"); tokens_in separates them (results §5.2).
  // Outcome categories are mutually exclusive; a policy violation is an OVERLAY (a gated cell can
  // still have passed the verifier), so it is reported as a separate "of which gated" row rather
  // than hiding a violation behind "success" or vice versa.
  const ORDER = ['success', 'timeout', 'startup/transport (no metered model call)', 'incompatible tool output (protocol; codex unmetered)',
    'incompatible/unapplied output (model answered, nothing committed)', 'unsuccessful execution (contract_format)', 'unsuccessful execution (tool_recovery)',
    'unsuccessful execution (state_continuation)', 'unsuccessful execution (evidence_grounding)', 'uncertain'];
  const cat = r => {
    if (r.result === 'passed' && !r.timed_out) return 'success';
    if (r.timed_out) return 'timeout';
    if (r.failure_mode === 'artifact_commitment' && (r.tokens_in ?? 0) === 0 && r.adapter !== 'codex') return 'startup/transport (no metered model call)';
    if (r.failure_mode === 'artifact_commitment' && r.adapter === 'codex') return 'incompatible tool output (protocol; codex unmetered)';
    if (r.failure_mode === 'artifact_commitment') return 'incompatible/unapplied output (model answered, nothing committed)';
    if (['contract_format', 'tool_recovery', 'state_continuation', 'evidence_grounding'].includes(r.failure_mode)) return `unsuccessful execution (${r.failure_mode})`;
    return 'uncertain';
  };
  const cohorts = ['battery.published', 'qwen35-scaled', 'phase-d-llama', 'anchor-tb'];
  const cats = new Map(ORDER.map(k => [k, {}]));
  const gated = {}, gatedPass = {}, total = {};
  for (const id of cohorts) for (const r of readLedger(id) || []) {
    const k = cat(r); cats.get(k)[id] = (cats.get(k)[id] || 0) + 1; total[id] = (total[id] || 0) + 1;
    if (r.safety && r.safety.gated) { gated[id] = (gated[id] || 0) + 1; if (k === 'success') gatedPass[id] = (gatedPass[id] || 0) + 1; }
  }
  const lines = ['| Outcome (rule-derived, exclusive) | ' + cohorts.map(c => '`' + c + '`').join(' | ') + ' |', '|---|' + cohorts.map(() => '--:').join('|') + '|'];
  for (const k of ORDER) lines.push(`| ${k} | ` + cohorts.map(c => cats.get(k)[c] || 0).join(' | ') + ' |');
  lines.push(`| **attempted (sum)** | ` + cohorts.map(c => `**${total[c] || 0}**`).join(' | ') + ' |');
  lines.push(`| *overlay: policy violation observed (\`safety.gated\`, any outcome)* | ` + cohorts.map(c => gated[c] || 0).join(' | ') + ' |');
  lines.push(`| *overlay: …of which the verifier still passed (gated passes)* | ` + cohorts.map(c => gatedPass[c] || 0).join(' | ') + ' |');
  lines.push('', '*Rule:* success = verifier passed & not timed out (the v1 primary outcome; a gated pass still counts as delivered here and is shown in the overlay) · timeout = `timed_out` · startup/transport = `artifact_commitment` with 0 metered input tokens (non-codex) · codex is unmetered, so its `artifact_commitment` zeros are classed as protocol failures from trace evidence, not tokens · remaining ledger taxonomy values = unsuccessful execution · residue = uncertain. This is a **post-hoc remap for the v1 paper**, not the pre-registered taxonomy.');
  return lines.join('\n');
}

function generate() {
  const head = ['| Ledger | Cohort | Dates | Harnesses | Models | Tasks | Seeds (repeat semantics) | Attempted / finished / passed / timed-out | Think | First commit |', '|---|---|---|---|---|--:|---|---|---|---|'];
  const table = head.concat(COHORTS.map(c => '| ' + cohortRow(c) + ' |')).join('\n');
  const curated = ['| Ledger | Role in the paper | Hardening / task version | Exploratory vs pre-registered |', '|---|---|---|---|']
    .concat(COHORTS.map(c => `| \`${c.id}\` | ${c.role} | ${c.hardening} | ${c.prereg} |`)).join('\n');
  return [
    BEGIN,
    `_Generated ${new Date().toISOString().slice(0, 10)} by \`node crucible/tools/inventory.js\` from \`crucible/results/*.jsonl\` + \`git log\`. Do not edit by hand._`,
    '', '### A.1 Cohort census (computed from ledgers)', '', table,
    '', '### A.2 Cohort role, hardening state, and epistemic status (curated; sources: phase notes, `docs/crucible-hypotheses.md` §5A, commit history)', '', curated,
    '', '### A.3 Task sets per cohort', '', taskSets(),
    '', '### A.4 Codex census — every cohort, attempted vs finished vs passed', '', codexCensus(),
    '', '### A.5 Failure categories (mentor taxonomy, rule-derived from ledger fields)', '', failureRemap(),
    END,
  ].join('\n');
}

const block = generate();
const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
const re = new RegExp(BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
if (process.argv.includes('--check')) {
  const m = existing.match(re);
  // ignore the date line when comparing
  const strip = s => s.replace(/_Generated \d{4}-\d{2}-\d{2}.*_/, '');
  if (!m || strip(m[0]) !== strip(block)) { console.error('paper/INVENTORY.md generated block is STALE — run node crucible/tools/inventory.js'); process.exit(1); }
  console.log('inventory: generated block is current'); process.exit(0);
}
if (!existing.match(re)) { console.error(`paper/INVENTORY.md lacks the marker block (${BEGIN} … ${END}); add it first`); process.exit(2); }
fs.writeFileSync(OUT, existing.replace(re, block));
console.log('wrote generated block into paper/INVENTORY.md');
