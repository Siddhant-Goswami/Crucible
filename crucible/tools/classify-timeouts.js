#!/usr/bin/env node
// classify-timeouts.js — post-hoc classification of timed-out battery cells (review blocker #1).
//
// A timeout counted as Goodput=0 can hide two different phenomena:
//   HUNG        — the harness stalled: no model request running and no file/proxy activity
//                 for a long tail before the watchdog killed it. A harness reliability failure.
//   CUT_OFF     — a model request was still in flight at kill time: the pair was still
//                 working and lost to the wall clock. A latency artifact of this host,
//                 NOT (only) harness flakiness.
// H4 ("reliability is first-class; Goodput is the decision metric") is confounded unless
// most timeouts are HUNG. This tool decides that from three independent evidence sources:
//   1. workdir file mtimes    (.runs/<cell>/ — TASK.md copy = run start; last write = activity)
//   2. proxy event log        (.proxy_events.jsonl — completed model calls only)
//   3. ollama server log      (GIN request lines: completion ts + duration => in-flight windows;
//                              valid because matrix.sh runs cells sequentially, NUM_PARALLEL=1)
//
// Usage: node crucible/tools/classify-timeouts.js [ledger] [--server-log /tmp/ollama-serve.log]
//        default ledger: crucible/results/battery.published.jsonl

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const slIdx = args.indexOf('--server-log');
const SERVER_LOG = slIdx >= 0 ? args[slIdx + 1] : '/tmp/ollama-serve.log';
const LEDGER = args.find(a => !a.startsWith('--') && a !== SERVER_LOG) ||
  path.join(ROOT, 'crucible', 'results', 'battery.published.jsonl');

const IDLE_TAIL_S = 60;          // silence this long before the kill => the harness was hung
const NEAR_KILL_GRACE_S = 45;    // watchdog poll + teardown slack around the nominal kill time
const CANARY_MIN = 5;            // tok/s below this at cell start => host was degraded (§5A.1)

function sanitize(model) { return model.replace(/[^A-Za-z0-9]/g, '_'); }

// ---- 1. stubs from the ledger --------------------------------------------------------------
const stubs = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
  .filter(r => r.timed_out);
if (!stubs.length) { console.log('no timed_out rows in ' + LEDGER); process.exit(0); }

// ---- 1b. canary sidecar (written by matrix.sh per cell, §5A.1) -------------------------------
// If the battery recorded host health at each cell's start, a cut-off cell whose canary was
// already below CANARY_MIN tok/s (or whose probe failed even after the unload retry) is
// HOST_DEGRADED — the host, not the pair, owns that timeout.
const canaryByCell = {};
const sidecarPath = LEDGER.replace(/\.jsonl$/, '.canary.jsonl');
if (fs.existsSync(sidecarPath)) {
  for (const line of fs.readFileSync(sidecarPath, 'utf8').split('\n').filter(Boolean)) {
    try { const c = JSON.parse(line); if (c.cell) canaryByCell[c.cell] = c; } catch {}
  }
}
const canaryUnhealthy = c => {
  if (!c) return false;
  const effective = c.action === 'unload_reprobe' ? c.tok_s_after : c.tok_s;
  return effective == null || effective < CANARY_MIN;
};

// ---- 2. server log: reconstruct request windows [start, end] -------------------------------
// GIN line: [GIN] 2026/06/30 - 13:30:19 | 200 | 34.195636875s | 127.0.0.1 | POST "/v1/chat/completions"
// Timestamps are the host's local time; Date.parse of "YYYY/MM/DDTHH:MM:SS" is treated as local.
function parseGoDur(s) {
  let ms = 0; const re = /([\d.]+)(h|m(?!s)|s|ms|µs|us)/g; let m;
  while ((m = re.exec(s))) {
    const v = parseFloat(m[1]);
    ms += m[2] === 'h' ? v * 3.6e6 : m[2] === 'm' ? v * 6e4 : m[2] === 's' ? v * 1e3
        : m[2] === 'ms' ? v : v / 1e3;
  }
  return ms / 1e3;
}
let reqs = [];
if (fs.existsSync(SERVER_LOG)) {
  const gin = /^\[GIN\]\s+(\d{4}\/\d{2}\/\d{2}) - (\d{2}:\d{2}:\d{2}) \|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*[\d.]+\s*\|\s*POST\s+"([^"]+)"/;
  for (const line of fs.readFileSync(SERVER_LOG, 'utf8').split('\n')) {
    const m = gin.exec(line);
    if (!m) continue;
    if (!/\/api\/(generate|chat)|\/v1\/(chat\/)?completions/.test(m[4])) continue;
    const end = new Date(m[1].replace(/\//g, '-') + 'T' + m[2]).getTime() / 1e3;
    const dur = parseGoDur(m[3]);
    reqs.push({ start: end - dur, end, dur, path: m[4] });
  }
  reqs.sort((a, b) => a.start - b.start);
} else {
  console.error('server log not found at ' + SERVER_LOG + ' — in-flight detection disabled');
}

// ---- 3. per-cell evidence -------------------------------------------------------------------
function mtimes(dir) {
  const out = {};
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    try { if (fs.statSync(p).isFile()) out[f] = fs.statSync(p).mtimeMs / 1e3; } catch {}
  }
  return out;
}
function budgets(dir) {
  try {
    const y = fs.readFileSync(path.join(dir, 'task.yaml'), 'utf8');
    const wt = /wall_timeout_s:\s*(\d+)/.exec(y);
    const mt = /max_tokens:\s*(\d+)/.exec(y);
    return { wt: wt ? +wt[1] : null, maxTok: mt ? +mt[1] : 0 };
  } catch { return { wt: null, maxTok: 0 }; }
}

const rows = [];
for (const s of stubs) {
  const cell = `${s.task}.${s.adapter}.${sanitize(s.model)}.s${s.seed}`;
  const dir = path.join(ROOT, '.runs', cell);
  const row = { cell, task: s.task, adapter: s.adapter, model: s.model, seed: s.seed };
  if (!fs.existsSync(dir)) { row.verdict = 'NO_EVIDENCE'; rows.push(row); continue; }

  const mt = mtimes(dir);
  // Run start = the OLDEST mtime in the dir. TASK.md/verify.sh/task.yaml are re-copied by the
  // integrity-restore before every verify, so their mtimes mark the LAST iteration, not setup;
  // the setup moment survives in the files the restore never touches (.proxy_port, fixtures).
  const start = Math.min(...Object.values(mt));
  const { wt, maxTok } = budgets(dir);
  if (!wt) { row.verdict = 'NO_EVIDENCE'; row.note = 'no wall_timeout_s'; rows.push(row); continue; }
  const kill = start + wt;

  // guard: dir must belong to the battery attempt, not a later manual re-run
  row.date = new Date(start * 1e3).toISOString();

  // last activity = newest mtime that is not a setup-time write (within 2s of start)
  const acts = Object.entries(mt).filter(([, t]) => t > start + 2).map(([, t]) => t);
  const lastAct = acts.length ? Math.max(...acts) : start;

  // proxy events (completed model calls). Token sum is a LOWER bound at kill time — the
  // in-flight request the watchdog killed never lands an event.
  let nEvents = 0, lastEvent = null, tokSum = 0;
  const evFile = path.join(dir, '.proxy_events.jsonl');
  if (fs.existsSync(evFile)) {
    const evs = fs.readFileSync(evFile, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    nEvents = evs.length;
    tokSum = evs.reduce((a, e) => a + (e.tokens_in || 0) + (e.tokens_out || 0), 0);
    if (evs.length) lastEvent = new Date(evs[evs.length - 1].ts).getTime() / 1e3;
  }

  // server-log: any request in flight at (or spanning) the kill?
  // strict in-flight test: the request must have STARTED before the kill (with a margin so the
  // next sequential cell's first request can never qualify) and still be running at kill time.
  const cellReqs = reqs.filter(r => r.end > start && r.start < kill);
  const inflight = cellReqs.filter(r => r.start <= kill - 2 && r.end >= kill - 2);
  const idleTail = kill - Math.max(lastAct, lastEvent || 0);

  row.wt = wt;
  row.n_model_calls = nEvents;
  row.reqs_in_window = cellReqs.length;
  row.idle_tail_s = Math.round(idleTail);
  row.inflight_at_kill = inflight.length > 0;

  row.tok_lower_bound = tokSum;
  row.max_tokens = maxTok;
  // Sub-attribute the cut-off cells by the HOST-INDEPENDENT budget: a cell already over its
  // token budget at kill would have failed on any hardware (harness overconsumption); one
  // within budget is a pure wall-clock victim (host-conditional model latency).
  if (inflight.length) {
    row.verdict = maxTok && tokSum >= maxTok ? 'CUT_OFF_TOKEN_OVERBUDGET' : 'CUT_OFF_WITHIN_BUDGET';
  } else if (nEvents === 0 && cellReqs.length === 0) row.verdict = 'HUNG_NEVER_CALLED';
  else if (idleTail >= IDLE_TAIL_S) row.verdict = 'HUNG';
  else row.verdict = 'AMBIGUOUS_NEAR_KILL';

  // §5A.1: a cut-off cell that STARTED on a degraded host is the host's timeout, not the pair's.
  // Only the WITHIN_BUDGET class remaps — TOKEN_OVERBUDGET is host-independent by construction
  // (over budget on any hardware). (Sidecar cell keys use the raw model name; ledger stubs carry
  // the same raw name.)
  const can = canaryByCell[`${s.task}.${s.adapter}.${s.model}.s${s.seed}`];
  if (row.verdict === 'CUT_OFF_WITHIN_BUDGET' && canaryUnhealthy(can)) {
    row.verdict = 'HOST_DEGRADED';
    row.canary_tok_s = can.action === 'unload_reprobe' ? can.tok_s_after : can.tok_s;
  }
  rows.push(row);
}

// ---- 4. report -------------------------------------------------------------------------------
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('cell', 46) + pad('wt', 5) + pad('calls', 6) + pad('idle_tail', 10) +
            pad('inflight', 9) + 'verdict');
for (const r of rows.sort((a, b) => a.cell.localeCompare(b.cell)))
  console.log(pad(r.cell, 46) + pad(r.wt ?? '—', 5) + pad(r.n_model_calls ?? '—', 6) +
              pad(r.idle_tail_s ?? '—', 10) + pad(r.inflight_at_kill ?? '—', 9) + r.verdict);

const by = {};
for (const r of rows) {
  const k = r.adapter + ' @ ' + r.model;
  (by[k] = by[k] || []).push(r.verdict);
}
console.log('\n== summary by (adapter, model) ==');
for (const [k, vs] of Object.entries(by).sort()) {
  const c = {};
  vs.forEach(v => (c[v] = (c[v] || 0) + 1));
  console.log(pad(k, 32) + Object.entries(c).map(([v, n]) => `${v}:${n}`).join('  '));
}
const total = {};
rows.forEach(r => (total[r.verdict] = (total[r.verdict] || 0) + 1));
console.log('\n== overall ==');
for (const [v, n] of Object.entries(total).sort((a, b) => b[1] - a[1]))
  console.log(pad(v, 24) + n + '  (' + Math.round((100 * n) / rows.length) + '%)');
const hung = (total.HUNG || 0) + (total.HUNG_NEVER_CALLED || 0);
const over = total.CUT_OFF_TOKEN_OVERBUDGET || 0;
const within = total.CUT_OFF_WITHIN_BUDGET || 0;
const degraded = total.HOST_DEGRADED || 0;
console.log(`\nH4 read: ${hung} hangs (harness failure on any host) · ` +
  `${over} cut off already over token budget (harness overconsumption, host-independent) · ` +
  `${within} cut off within token budget (wall-clock/latency, HOST-CONDITIONAL) · ` +
  `${degraded} on a degraded host (canary below ${CANARY_MIN} tok/s — the HOST owns these). ` +
  `\nGoodput remains the right delivery metric, but "reliability is a harness property" must be ` +
  `re-attributed: only hangs and token-overbudget travel across hardware.`);
