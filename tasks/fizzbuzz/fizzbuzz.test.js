// fizzbuzz.test.js — the termination condition. Node's built-in runner, no deps.
const test = require('node:test');
const assert = require('node:assert');
const { fizzbuzz } = require('./fizzbuzz');

test('fizzbuzz covers all four cases', () => {
  assert.strictEqual(fizzbuzz(1), '1');
  assert.strictEqual(fizzbuzz(7), '7');
  assert.strictEqual(fizzbuzz(3), 'Fizz');
  assert.strictEqual(fizzbuzz(9), 'Fizz');
  assert.strictEqual(fizzbuzz(5), 'Buzz');
  assert.strictEqual(fizzbuzz(10), 'Buzz');
  assert.strictEqual(fizzbuzz(15), 'FizzBuzz');
  assert.strictEqual(fizzbuzz(30), 'FizzBuzz');
  assert.strictEqual(fizzbuzz(45), 'FizzBuzz');
});
