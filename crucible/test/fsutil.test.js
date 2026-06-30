'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { globMatch, readTrace, writtenSince, snapshot, walk } = require('../lib/fsutil');

test('glob: secrets/** matches descendants but NOT sibling prefixes (regression)', () => {
  assert.strictEqual(globMatch('secrets/api.txt', ['secrets/**']), true);
  assert.strictEqual(globMatch('secrets/deep/x', ['secrets/**']), true);
  assert.strictEqual(globMatch('secrets-backup/x', ['secrets/**']), false);
  assert.strictEqual(globMatch('secrets', ['secrets/**']), false);
});

test('glob: * stays within a segment; ? is one char', () => {
  assert.strictEqual(globMatch('a.js', ['*.js']), true);
  assert.strictEqual(globMatch('a/b.js', ['*.js']), false);
  assert.strictEqual(globMatch('a/b.js', ['**/*.js']), true);
  assert.strictEqual(globMatch('ab', ['a?']), true);
  assert.strictEqual(globMatch('abc', ['a?']), false);
});

test('readTrace: valid lines parse, missing flagged, corrupt line counted', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cru-'));
  const f = path.join(dir, 't.jsonl');
  fs.writeFileSync(f, '{"iter":1}\n{"iter":2}\n');
  assert.deepStrictEqual(readTrace(f), { records: [{ iter: 1 }, { iter: 2 }], errors: 0, missing: false });
  fs.writeFileSync(f, '{"iter":1}\n{BROKEN\n{"iter":3}\n');
  const r = readTrace(f);
  assert.strictEqual(r.errors, 1);
  assert.strictEqual(r.records.length, 2);
  assert.strictEqual(readTrace(path.join(dir, 'nope.jsonl')).missing, true);
});

test('writtenSince detects new + changed files', () => {
  assert.deepStrictEqual(writtenSince({ a: '1' }, { a: '1', b: '2' }), ['b']);
  assert.deepStrictEqual(writtenSince({ a: '1' }, { a: '9' }), ['a']);
  assert.deepStrictEqual(writtenSince({ a: '1' }, { a: '1' }), []);
});

test('walk/snapshot excludes protected, plumbing, hidden, and noise dirs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cru-'));
  fs.writeFileSync(path.join(dir, 'src.js'), 'x');
  fs.writeFileSync(path.join(dir, 'verify.sh'), 'x');      // protected
  fs.writeFileSync(path.join(dir, 'sum.test.js'), 'x');    // protected
  fs.writeFileSync(path.join(dir, 'trace.jsonl'), 'x');    // plumbing
  fs.writeFileSync(path.join(dir, '.tokens'), 'x');        // hidden
  fs.mkdirSync(path.join(dir, 'node_modules'));
  fs.writeFileSync(path.join(dir, 'node_modules', 'dep.js'), 'x');
  assert.deepStrictEqual(walk(dir), ['src.js']);
  assert.deepStrictEqual(Object.keys(snapshot(dir)), ['src.js']);
});
