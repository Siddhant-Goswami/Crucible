#!/usr/bin/env node
// export.js — exports the embedded dataset to out/export.json.
// T1 recovery shape: MISSING CONFIG. The exporter refuses to run until config/settings.json
// exists with exactly the content its error message specifies — the agent must read the error,
// create the file, and re-run. The artifact embeds sha256(SALT + rows), a proof-of-execution
// the verifier checks, so it cannot be hand-written (computing the hash requires executing code).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dir = __dirname;

const SALT = 'crucible-export-v1';
const RECORDS = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: 'item-' + ((i * 13) % 97) }));
module.exports = { RECORDS, SALT };

const REQUIRED = { format: 'json', fields: ['id', 'name'] };

function main() {
  const cfgPath = path.join(dir, 'config', 'settings.json');
  let cfg = null;
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
  const ok = cfg && cfg.format === REQUIRED.format &&
    Array.isArray(cfg.fields) && cfg.fields.join(',') === REQUIRED.fields.join(',');
  if (!ok) {
    console.error('export: MISSING OR INVALID CONFIG.');
    console.error('export: create the file `config/settings.json` containing exactly:');
    console.error('export:   {"format":"json","fields":["id","name"]}');
    console.error('export: then re-run `node export.js`.');
    process.exit(1);
  }
  const rows = RECORDS.map(r => ({ id: r.id, name: r.name }));
  const proof = crypto.createHash('sha256').update(SALT + JSON.stringify(rows)).digest('hex');
  fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'out', 'export.json'), JSON.stringify({ proof, rows }));
  console.log('export: wrote out/export.json (' + rows.length + ' rows).');
}
if (require.main === module) main();
