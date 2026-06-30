'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const core = require('./core');
const a = require('./a');
const b = require('./b');
const c = require('./c');
const d = require('./d');

test('tally was renamed to total consistently across all files', () => {
  assert.strictEqual(typeof core.total, 'function', 'core must export `total`');
  assert.strictEqual(core.tally, undefined, 'the old name `tally` must be removed from core');
  // each consumer must call the NEW name (a stale core.tally(...) throws here)
  assert.strictEqual(a([1, 2, 3]), 7);
  assert.strictEqual(b([1, 2, 3]), 8);
  assert.strictEqual(c([1, 2, 3]), 9);
  assert.strictEqual(d([1, 2, 3]), 10);
});
