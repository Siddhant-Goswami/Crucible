'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { factorial } = require('./mathlib');

test('factorial matches the generated fixtures', () => {
  const p = path.join(__dirname, 'fixtures', 'cases.json');
  assert.ok(fs.existsSync(p), 'fixtures/cases.json missing — run `node gen.js` (twice; see its output)');
  const cases = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(cases.length >= 100, 'too few fixture cases — regenerate with `node gen.js`');
  for (const c of cases) assert.strictEqual(factorial(c.n), c.expected, `factorial(${c.n})`);
});
