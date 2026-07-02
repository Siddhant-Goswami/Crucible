'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { mean, median, bootCI, pairedBoot, priceRun, priceRunCloud } = require('../lib/stats');

const zero = () => 0;   // deterministic RNG: always sample index 0

test('mean', () => {
  assert.strictEqual(mean([2, 4, 6]), 4);
  assert.strictEqual(mean([]), 0);
});

test('bootCI is degenerate for n<2 and with a constant sampler', () => {
  assert.deepStrictEqual(bootCI([7]), [7, 7]);
  assert.deepStrictEqual(bootCI([5, 5, 5], 10, zero), [5, 5]);
});

test('pairedBoot pairs only keys present in BOTH maps (task|seed)', () => {
  const a = { 't|1': 1, 't|2': 1, 'x|1': 1 };   // x|1 has no pair
  const b = { 't|1': 0, 't|2': 0 };
  const pb = pairedBoot(a, b, 10, zero);
  assert.strictEqual(pb.n, 2);                  // only the two shared keys
  assert.strictEqual(pb.diff, 1);
  assert.strictEqual(pb.sig, true);             // CI [1,1] excludes 0
});

test('pairedBoot needs >=2 shared keys for a CI', () => {
  const pb = pairedBoot({ 't|1': 1 }, { 't|1': 0 });
  assert.strictEqual(pb.n, 1);
  assert.ok(Number.isNaN(pb.lo));
  assert.strictEqual(pb.sig, false);
});

test('priceRun: claude keyed directly, local models => $0', () => {
  const pricing = { models: { 'claude-opus-4-8': { in: 5, out: 25 }, 'ollama/qwen3:8b': { in: 0, out: 0 } } };
  assert.strictEqual(priceRun({ model: 'claude-opus-4-8', tokens_in: 1e6, tokens_out: 1e6 }, pricing), 30);
  assert.strictEqual(priceRun({ model: 'qwen3:8b', tokens_in: 1e6, tokens_out: 1e6 }, pricing), 0);
  assert.strictEqual(priceRun({ model: 'baseline', tokens_in: 5, tokens_out: 5 }, pricing), 0);
  assert.strictEqual(priceRun({ model: 'deepseek-r1:1.5b', tokens_in: 9, tokens_out: 9 }, pricing), 0); // unknown => $0
});

test('median: odd, even, empty', () => {
  assert.strictEqual(median([3, 1, 2]), 2);
  assert.strictEqual(median([1, 2, 3, 4]), 2.5);
  assert.strictEqual(median([]), 0);
  assert.strictEqual(median([9, 1, 1, 9]), 5);   // does not mutate/assume sorted input
});

test('priceRunCloud: OSS local models priced at hosted rate; unpriced => null', () => {
  const pricing = { models: {
    'claude-opus-4-8': { in: 5, out: 25 },
    'openrouter/qwen3:8b': { in: 1, out: 2 },   // $/Mtok
  } };
  // local OSS model prices at its openrouter/<model> rate (the apples-to-apples cloud-equiv $)
  assert.strictEqual(priceRunCloud({ model: 'qwen3:8b', tokens_in: 1e6, tokens_out: 1e6 }, pricing), 3);
  // claude prices at its own rate
  assert.strictEqual(priceRunCloud({ model: 'claude-opus-4-8', tokens_in: 1e6, tokens_out: 1e6 }, pricing), 30);
  // an OSS model with no openrouter entry => null (unpriced, shown as —), not a misleading 0
  assert.strictEqual(priceRunCloud({ model: 'deepseek-r1:8b', tokens_in: 9, tokens_out: 9 }, pricing), null);
  assert.strictEqual(priceRunCloud({ model: 'baseline', tokens_in: 9, tokens_out: 9 }, pricing), null);
});
