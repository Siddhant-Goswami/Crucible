// sum.test.js — the termination condition, written as a test.
// Uses node's built-in test runner (no dependencies, no npm install).
const test = require('node:test');
const assert = require('node:assert');
const { sum } = require('./sum');

test('sum adds two numbers', () => {
  assert.strictEqual(sum(2, 3), 5);
  assert.strictEqual(sum(-1, 1), 0);
  assert.strictEqual(sum(0, 0), 0);
  assert.strictEqual(sum(100, 250), 350);
});
