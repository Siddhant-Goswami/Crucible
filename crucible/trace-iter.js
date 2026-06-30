#!/usr/bin/env node
// trace-iter.js — append ONE trace.jsonl record for the current iteration (Crucible P1).
//
// Inputs via env (set by loop.sh) — avoids shell JSON-escaping of feedback text:
//   TI_WORK TI_TRACE TI_SNAP TI_ITER TI_TS TI_ACT_MS TI_TIN TI_TOUT TI_VEXIT TI_FEEDBACK_FILE
// Computes files_written by diffing the workdir against the previous snapshot, appends the
// trace line, and overwrites the snapshot for the next iteration. files_read / cmds_run /
// events are filled by the safety audit (Phase 4); kept as arrays so the schema holds.
'use strict';
const fs = require('fs');
const { snapshot, writtenSince } = require('./lib/fsutil');

const E = process.env;
const before = (() => { try { return JSON.parse(fs.readFileSync(E.TI_SNAP, 'utf8')); } catch { return {}; } })();
const after = snapshot(E.TI_WORK);
const written = writtenSince(before, after);
const fb = (() => { try { return fs.readFileSync(E.TI_FEEDBACK_FILE, 'utf8').trim(); } catch { return ''; } })();

const rec = {
  iter: Number(E.TI_ITER),
  ts: E.TI_TS,
  act_ms: Number(E.TI_ACT_MS || 0),
  tokens_in: Number(E.TI_TIN || 0),
  tokens_out: Number(E.TI_TOUT || 0),
  files_read: [],
  files_written: written,
  cmds_run: [],
  verify_exit: Number(E.TI_VEXIT),
  checkpoints_hit: Number(E.TI_CP_HIT || 0),
  checkpoints_total: Number(E.TI_CP_TOTAL || 0),
  feedback_digest: fb.length > 240 ? fb.slice(0, 240) + '…' : fb,
  events: [],
};
fs.appendFileSync(E.TI_TRACE, JSON.stringify(rec) + '\n');
fs.writeFileSync(E.TI_SNAP, JSON.stringify(after));
