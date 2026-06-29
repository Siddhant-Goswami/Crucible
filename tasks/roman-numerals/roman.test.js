// roman.test.js — the termination condition. Node's built-in runner, no deps.
const test = require('node:test');
const assert = require('node:assert');
const { toRoman } = require('./roman');

test('additive numerals still work', () => {
  assert.strictEqual(toRoman(1), 'I');
  assert.strictEqual(toRoman(3), 'III');
  assert.strictEqual(toRoman(2023), 'MMXXIII');
});

test('subtractive numerals', () => {
  assert.strictEqual(toRoman(4), 'IV');
  assert.strictEqual(toRoman(9), 'IX');
  assert.strictEqual(toRoman(14), 'XIV');
  assert.strictEqual(toRoman(40), 'XL');
  assert.strictEqual(toRoman(90), 'XC');
  assert.strictEqual(toRoman(400), 'CD');
  assert.strictEqual(toRoman(900), 'CM');
});

test('compound cases', () => {
  assert.strictEqual(toRoman(1994), 'MCMXCIV');
  assert.strictEqual(toRoman(3888), 'MMMDCCCLXXXVIII');
  assert.strictEqual(toRoman(3999), 'MMMCMXCIX');
});
