#!/usr/bin/env node
// gen.js — generates fixtures/cases.json, the test ORACLE. Computes expected factorials with
// its own correct reference. Two-phase on purpose: the first run initializes a stamp and exits
// non-zero with instructions; re-run to actually generate (this is the "recover-and-retry" the
// task tests). A file-only harness can't run this at all; a tool-capable one runs it twice.
//
// v2 (proof-of-execution, results §6.3): phase 1 writes a RANDOM nonce into .gen-stamp; phase 2
// embeds sha256(nonce + cases) into the fixture. A strong model can hand-write 200 factorials,
// but it cannot hand-compute the sha256 — producing a valid fixture requires EXECUTING code,
// which is the capability this T1 task exists to measure.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dir = __dirname;

const ref = n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };  // correct factorial
const stamp = path.join(dir, '.gen-stamp');

if (!fs.existsSync(stamp)) {
  fs.writeFileSync(stamp, crypto.randomBytes(16).toString('hex') + '\n');
  console.error('gen: initialized (created .gen-stamp). Re-run `node gen.js` to write fixtures/cases.json.');
  process.exit(1);
}

// 200 cases over n = 0..12 (factorials stay safe integers); too many to hand-write.
const nonce = fs.readFileSync(stamp, 'utf8').trim();
const cases = [];
for (let i = 0; i < 200; i++) { const n = i % 13; cases.push({ n, expected: ref(n) }); }
const proof = crypto.createHash('sha256').update(nonce + JSON.stringify(cases)).digest('hex');
fs.mkdirSync(path.join(dir, 'fixtures'), { recursive: true });
fs.writeFileSync(path.join(dir, 'fixtures', 'cases.json'), JSON.stringify({ nonce, proof, cases }));
console.log(`gen: wrote fixtures/cases.json (${cases.length} cases, proof-of-execution embedded).`);
