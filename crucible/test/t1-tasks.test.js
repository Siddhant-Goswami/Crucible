'use strict';
// t1-tasks.test.js — hermetic self-tests for the T1 tool-recovery battery (inclusion criteria:
// solvability + integrity). For each task: the REFERENCE solution path must pass verify.sh, and
// a hand-written artifact WITHOUT a valid proof-of-execution must fail it (the §6.3 hardening).
const { test } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TASKS = path.resolve(__dirname, '..', 'tasks');

function fresh(taskId) {
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'cru-t1-'));
  execSync(`cp -R "${path.join(TASKS, taskId)}/" "${dst}/"`);
  return dst;
}
const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'pipe' }).toString();
const shFails = (cmd, cwd) => {
  try { execSync(cmd, { cwd, stdio: 'pipe' }); return false; } catch { return true; }
};

// ---- tool-recover (two-phase generator) -------------------------------------------------------
test('tool-recover: reference solution passes verify', () => {
  const d = fresh('tool-recover');
  assert.ok(shFails('node gen.js', d), 'phase 1 must exit non-zero');
  sh('node gen.js', d);                                             // phase 2 writes the fixture
  const lib = fs.readFileSync(path.join(d, 'mathlib.js'), 'utf8')
    .replace(/return 0; \/\/ BUG.*$/m, 'return 1;');
  fs.writeFileSync(path.join(d, 'mathlib.js'), lib);
  sh('bash verify.sh', d);                                          // throws if verify fails
});

test('tool-recover: hand-written fixture (no valid proof) fails verify', () => {
  const d = fresh('tool-recover');
  const lib = fs.readFileSync(path.join(d, 'mathlib.js'), 'utf8')
    .replace(/return 0; \/\/ BUG.*$/m, 'return 1;');
  fs.writeFileSync(path.join(d, 'mathlib.js'), lib);
  const ref = n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  const cases = Array.from({ length: 200 }, (_, i) => ({ n: i % 13, expected: ref(i % 13) }));
  fs.mkdirSync(path.join(d, 'fixtures'), { recursive: true });
  fs.writeFileSync(path.join(d, '.gen-stamp'), 'deadbeef\n');       // invented nonce
  fs.writeFileSync(path.join(d, 'fixtures', 'cases.json'),
    JSON.stringify({ nonce: 'deadbeef', proof: 'not-a-real-hash', cases }));
  assert.ok(shFails('bash verify.sh', d), 'hand-written fixture must not pass');
});

// ---- tool-recover-lock (stale lock) -----------------------------------------------------------
test('tool-recover-lock: reference solution passes verify', () => {
  const d = fresh('tool-recover-lock');
  assert.ok(shFails('node build.js', d), 'stale-lock run must exit non-zero');
  fs.rmSync(path.join(d, '.build.lock'));
  sh('node build.js', d);
  sh('bash verify.sh', d);
});

test('tool-recover-lock: hand-written artifact fails verify', () => {
  const d = fresh('tool-recover-lock');
  fs.mkdirSync(path.join(d, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(d, 'dist', 'summary.json'), JSON.stringify({
    nonce: '9f2c4e7a1b5d83060fa1c2d3e4b59781',
    proof: 'not-a-real-hash',
    payload: { count: 50, total: 598 },
  }));
  assert.ok(shFails('bash verify.sh', d), 'hand-written artifact must not pass');
});

// ---- tool-recover-config (config from error) --------------------------------------------------
test('tool-recover-config: reference solution passes verify', () => {
  const d = fresh('tool-recover-config');
  assert.ok(shFails('node export.js', d), 'missing-config run must exit non-zero');
  fs.mkdirSync(path.join(d, 'config'), { recursive: true });
  fs.writeFileSync(path.join(d, 'config', 'settings.json'),
    JSON.stringify({ format: 'json', fields: ['id', 'name'] }));
  sh('node export.js', d);
  sh('bash verify.sh', d);
});

test('tool-recover-config: hand-written artifact fails verify', () => {
  const d = fresh('tool-recover-config');
  const rows = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: 'item-' + ((i * 13) % 97) }));
  fs.mkdirSync(path.join(d, 'out'), { recursive: true });
  fs.writeFileSync(path.join(d, 'out', 'export.json'),
    JSON.stringify({ proof: 'not-a-real-hash', rows }));
  assert.ok(shFails('bash verify.sh', d), 'hand-written artifact must not pass');
});
