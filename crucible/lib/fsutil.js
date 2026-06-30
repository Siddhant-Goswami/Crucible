'use strict';
// fsutil.js — shared filesystem helpers for Crucible instrumentation.
// Used by trace-iter.js (writes diff), audit.js (policy globs), finalize.js.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Files that are hidden audit artifacts or harness plumbing — never counted as
// agent writes, never shown as task content. Mirrors loop.sh's protected set + Crucible's.
const PROTECTED = /(^|\/)(verify\.sh|TASK\.md|task\.yaml|checkpoints\.sh|policy\.json)$|\.test\.js$|[-_]test\.js$|(^|\/)test\.js$/;
const NOISE_DIR = /(^|\/)(\.git|node_modules)(\/|$)/;
// Crucible/loop plumbing that lives in the workdir but is NOT an agent write.
const PLUMBING = /(^|\/)(trace\.jsonl|result\.json)$/;

// List task-content files under dir (relative paths), excluding noise, dotfiles, protected.
function walk(dir) {
  const out = [];
  (function rec(abs, rel) {
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;                 // hidden / .feedback / .tokens / .snap
      const r = rel ? rel + '/' + e.name : e.name;
      if (NOISE_DIR.test(r)) continue;
      if (e.isDirectory()) rec(path.join(abs, e.name), r);
      else if (e.isFile() && !PROTECTED.test(r) && !PLUMBING.test(r)) out.push(r);
    }
  })(dir, '');
  return out.sort();
}

function snapshot(dir) {
  const snap = {};
  for (const rel of walk(dir)) {
    try { snap[rel] = crypto.createHash('md5').update(fs.readFileSync(path.join(dir, rel))).digest('hex'); }
    catch {}
  }
  return snap;
}

// Files in `after` that are new or changed vs `before`.
function writtenSince(before, after) {
  return Object.keys(after).filter(k => before[k] !== after[k]).sort();
}

// Minimal glob -> RegExp supporting ** (any depth), * (within segment), ? (one char).
function globToRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
      else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}
function globMatch(p, patterns) {
  return (patterns || []).some(g => globToRe(g).test(p));
}

module.exports = { PROTECTED, walk, snapshot, writtenSince, globToRe, globMatch };
