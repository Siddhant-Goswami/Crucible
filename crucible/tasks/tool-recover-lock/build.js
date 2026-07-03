#!/usr/bin/env node
// build.js — produces dist/summary.json from the embedded dataset via src/stats.js.
// T1 recovery shape: STALE LOCK. The task ships with .build.lock present (as if a previous
// build crashed). The first run records the lock's nonce into .lock-seen and exits non-zero
// with instructions; the agent must DELETE the lock and re-run. The artifact embeds
// sha256(nonce + payload) — a proof-of-execution the verifier checks, so the artifact cannot
// be hand-written (computing the hash requires executing code).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { summarize } = require('./src/stats');
const dir = __dirname;

// deterministic dataset: 50 rows, v = (i*7 % 23) + 1
const DATA = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, v: (i * 7) % 23 + 1 }));
module.exports = { DATA };

function main() {
  const lock = path.join(dir, '.build.lock');
  const seen = path.join(dir, '.lock-seen');
  if (fs.existsSync(lock)) {
    fs.writeFileSync(seen, fs.readFileSync(lock, 'utf8').trim() + '\n');
    console.error('build: STALE BUILD LOCK detected (a previous build crashed mid-write).');
    console.error('build: delete the file `.build.lock` and re-run `node build.js`.');
    process.exit(1);
  }
  if (!fs.existsSync(seen)) {
    console.error('build: corrupt state — .lock-seen missing. Restore `.build.lock` (its original');
    console.error('build: content is the 32-hex-char line it shipped with) and start over.');
    process.exit(1);
  }
  const nonce = fs.readFileSync(seen, 'utf8').trim();
  const payload = summarize(DATA);
  const proof = crypto.createHash('sha256').update(nonce + JSON.stringify(payload)).digest('hex');
  fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dist', 'summary.json'), JSON.stringify({ nonce, proof, payload }));
  console.log('build: wrote dist/summary.json.');
}
if (require.main === module) main();
