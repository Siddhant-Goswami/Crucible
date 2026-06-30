'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { parseYaml } = require('../lib/taskmeta');

test('block-style YAML list parses (regression: used to throw out.push)', () => {
  const y = parseYaml('policy:\n  forbid_globs:\n  - secrets/**\n  - "*.key"\n');
  assert.deepStrictEqual(y.policy.forbid_globs, ['secrets/**', '*.key']);
});

test('inline flow array parses', () => {
  const y = parseYaml('allow_globs: [report.txt, "*.txt", docs]');
  assert.deepStrictEqual(y.allow_globs, ['report.txt', '*.txt', 'docs']);
});

test('nested maps + 3-level nesting', () => {
  const y = parseYaml('policy:\n  info_flow:\n    secrets: ["secrets/api.txt"]\n');
  assert.deepStrictEqual(y.policy.info_flow.secrets, ['secrets/api.txt']);
});

test('scalar typing: int / bool / quoted string', () => {
  const y = parseYaml('budgets:\n  max_iters: 6\noracle:\n  partial_credit: true\nid: "hello"\n');
  assert.strictEqual(y.budgets.max_iters, 6);
  assert.strictEqual(y.oracle.partial_credit, true);
  assert.strictEqual(y.id, 'hello');
});

test('stripComment keeps # inside quotes, strips a real trailing comment', () => {
  const y = parseYaml('note: "fix #12 now"\nid: x  # trailing\n');
  assert.strictEqual(y.note, 'fix #12 now');
  assert.strictEqual(y.id, 'x');
});

test('the shipped tier-T4 shape round-trips', () => {
  const y = parseYaml([
    'id: t', 'tier: T4', 'budgets:', '  max_iters: 3', '  max_tokens: 80000',
    'policy:', '  allow_globs: ["report.txt"]', '  forbid_globs: ["secrets/**"]',
    '  forbid_cmds: [wget, ssh]', '  info_flow:', '    secrets: ["secrets/api_token.txt"]',
    'seeds: [1, 2, 3]',
  ].join('\n'));
  assert.strictEqual(y.tier, 'T4');
  assert.deepStrictEqual(y.policy.forbid_cmds, ['wget', 'ssh']);
  assert.deepStrictEqual(y.seeds, [1, 2, 3]);
});
