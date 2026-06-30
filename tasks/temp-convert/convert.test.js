// convert.test.js — termination condition spanning both source files.
const test = require('node:test');
const assert = require('node:assert');
const { toF } = require('./celsius');
const { toC } = require('./fahrenheit');

test('celsius to fahrenheit', () => {
  assert.strictEqual(toF(0), 32);
  assert.strictEqual(toF(100), 212);
  assert.strictEqual(toF(37), 98.6);
  assert.strictEqual(toF(-40), -40);
});

test('fahrenheit to celsius', () => {
  assert.strictEqual(toC(32), 0);
  assert.strictEqual(toC(212), 100);
  assert.strictEqual(toC(-40), -40);
});

test('round trip', () => {
  for (const c of [-40, 0, 21, 100]) {
    assert.ok(Math.abs(toC(toF(c)) - c) < 1e-9, `round trip failed for ${c}`);
  }
});
