#!/usr/bin/env node
// audit.js — Crucible safety audit (P6) CLI. Resolves the task policy, reads the trace, and
// computes per-channel boundary compliance (SAR) via lib/audit-core, the basis for the gate.
//
// SAFETY-CRITICAL: this FAILS CLOSED. If the policy can't be parsed, the trace has a corrupt
// line, or anything else throws, the run is gated (SAR=0) rather than defaulted to safe — a
// safety gate that fails open on malformed config is worse than none.
//
// Inputs via env: AUD_WORK AUD_TASK_DIR AUD_TRACE AUD_CMDLOG AUD_OUT.
'use strict';
const fs = require('fs');
const path = require('path');
const { readTrace } = require('./lib/fsutil');
const { loadPolicy, safeRel } = require('./lib/policy');
const { auditChannels } = require('./lib/audit-core');

const E = process.env;
const out = E.AUD_OUT || path.join(E.AUD_WORK, '.audit.json');
const write = o => { try { fs.writeFileSync(out, JSON.stringify(o)); } catch {} };
const CLEAN = { tool_sar: 1, resource_sar: 1, info_sar: 1, events: [] };
const failClosed = detail => ({
  tool_sar: 0, resource_sar: 0, info_sar: 0,
  events: [{ type: 'policy_violation', channel: 'resource', severity: 'high', detail }],
});

try {
  const { policy, error } = loadPolicy(E.AUD_TASK_DIR);
  if (error) { write(failClosed('task.yaml policy unparseable (' + error.message + ') — failing closed')); process.exit(0); }
  if (!policy) { write(CLEAN); process.exit(0); }             // genuinely no policy: Safety axis n/a

  const { records: trace, errors: traceErrors } = readTrace(E.AUD_TRACE);
  // A corrupt trace line could hide a write from the audit — fail closed rather than certify
  // safety from incomplete evidence.
  if (traceErrors > 0) { write(failClosed(`trace had ${traceErrors} unparseable line(s) — failing closed`)); process.exit(0); }
  const written = [...new Set(trace.flatMap(t => t.files_written || []))].filter(safeRel);

  const result = auditChannels({ policy, written, taskDir: E.AUD_TASK_DIR, work: E.AUD_WORK, cmdlog: E.AUD_CMDLOG });
  write(result);
  process.stderr.write(`audit: tool=${result.tool_sar} resource=${result.resource_sar} info=${result.info_sar} violations=${result.events.length}\n`);
} catch (e) {
  write(failClosed('audit error: ' + (e && e.message) + ' — failing closed'));
  process.exit(0);
}
