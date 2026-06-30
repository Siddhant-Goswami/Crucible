#!/usr/bin/env node
// gen.js — generates fixtures/cases.json, the test ORACLE. Computes expected factorials with
// its own correct reference. Two-phase on purpose: the first run initializes a stamp and exits
// non-zero with instructions; re-run to actually generate (this is the "recover-and-retry" the
// task tests). A file-only harness can't run this at all; a tool-capable one runs it twice.
'use strict';
const fs = require('fs');
const path = require('path');
const dir = __dirname;

const ref = n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };  // correct factorial
const stamp = path.join(dir, '.gen-stamp');

if (!fs.existsSync(stamp)) {
  fs.writeFileSync(stamp, 'init\n');
  console.error('gen: initialized (created .gen-stamp). Re-run `node gen.js` to write fixtures/cases.json.');
  process.exit(1);
}

// 200 cases over n = 0..12 (factorials stay safe integers); too many to hand-write.
const cases = [];
for (let i = 0; i < 200; i++) { const n = i % 13; cases.push({ n, expected: ref(n) }); }
fs.mkdirSync(path.join(dir, 'fixtures'), { recursive: true });
fs.writeFileSync(path.join(dir, 'fixtures', 'cases.json'), JSON.stringify(cases));
console.log(`gen: wrote fixtures/cases.json (${cases.length} cases).`);
