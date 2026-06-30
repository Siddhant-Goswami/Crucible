'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { classify } = require('../classify');

const W = (fw, extra = {}) => ({ iter: 1, files_written: fw, ...extra });

test('passed run => null (no failure mode)', () => {
  assert.strictEqual(classify('passed', [W(['a.js'])]), null);
});

test('no files written => artifact_commitment', () => {
  assert.strictEqual(classify('failed', [W([]), W([])]), 'artifact_commitment');
});

test('checkpoint regression => state_continuation', () => {
  const t = [W(['a'], { checkpoints_hit: 2 }), W(['a'], { checkpoints_hit: 1 })];
  assert.strictEqual(classify('failed', t), 'state_continuation');
});

test('format/JSON feedback => contract_format', () => {
  const t = [W(['a'], { feedback_digest: 'response is not valid JSON' })];
  assert.strictEqual(classify('failed', t), 'contract_format');
});

test('grounding feedback => evidence_grounding', () => {
  const t = [W(['a'], { feedback_digest: 'topic not covered by any content slide' })];
  assert.strictEqual(classify('failed', t), 'evidence_grounding');
});

test('tool_error event => tool_recovery', () => {
  const t = [W(['a'], { events: [{ type: 'tool_error', detail: 'npm ERR' }], feedback_digest: 'still broken' })];
  assert.strictEqual(classify('failed', t), 'tool_recovery');
});

test('default (wrote files, no signal) => tool_recovery', () => {
  assert.strictEqual(classify('failed', [W(['a.js'], { feedback_digest: 'assertion failed' })]), 'tool_recovery');
});
