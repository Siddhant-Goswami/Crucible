'use strict';
// policy.js — shared task-policy resolution + path safety, used by audit.js and finalize.js
// (so the resolution rule lives in ONE place).
const fs = require('fs');
const path = require('path');
const taskmeta = require('./taskmeta');

// Reject absolute paths or any `..` segment so a policy/trace-provided path can't escape the
// task directory (CWE-22 guard).
const safeRel = p => typeof p === 'string' && p !== '' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..');

// Resolve a task's policy. Returns { policy, error } where `error` is set IFF a task.yaml exists
// but its policy could not be parsed — callers that gate on safety must FAIL CLOSED on error,
// and must NOT treat a parse error as "no policy" (which would fail open). `policy.json` is a fallback.
function loadPolicy(taskDir) {
  let policy = null, error = null;
  try { const m = taskmeta.load(taskDir); policy = (m && m.policy) || null; }
  catch (e) { error = e; }
  if (!policy && !error) {
    try { policy = JSON.parse(fs.readFileSync(path.join(taskDir, 'policy.json'), 'utf8')); } catch {}
  }
  return { policy, error };
}

module.exports = { safeRel, loadPolicy };
