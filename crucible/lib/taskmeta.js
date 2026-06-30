'use strict';
// taskmeta.js — a tiny YAML-subset reader for Crucible task.yaml (the repo is
// dependency-free, so we parse the controlled subset we author rather than add js-yaml).
// Supports: nested maps by indentation, `key: value` scalars (int/bool/string),
// inline flow arrays `[a, b, "c"]`, and block lists (`- item`). Not a general YAML parser.
const fs = require('fs');
const path = require('path');

function scalar(v) {
  v = v.trim();
  if (v === '') return '';
  if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) return v.slice(1, -1);
  if (v[0] === '[') {                                  // inline flow array
    const inner = v.slice(1, v.lastIndexOf(']')).trim();
    if (!inner) return [];
    return inner.split(',').map(s => scalar(s));
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v);
  return v;
}

function stripComment(line) {
  // remove a trailing " # comment" but not '#' inside quotes (our files don't use # in values)
  const i = line.indexOf(' #');
  return i >= 0 ? line.slice(0, i) : line;
}

function parseYaml(text) {
  const lines = text.split('\n')
    .map(l => stripComment(l.replace(/\t/g, '  ')))
    .filter(l => l.trim() !== '' && l.trim() !== '---');
  let pos = 0;

  function indentOf(l) { return l.length - l.trimStart().length; }

  // consume consecutive `- item` lines at exactly `indent` (a block list under a key,
  // which YAML commonly puts at the KEY's own indent rather than deeper).
  function listAt(indent) {
    const arr = [];
    while (pos < lines.length) {
      const l = lines[pos];
      if (indentOf(l) !== indent || !l.trim().startsWith('- ')) break;
      arr.push(scalar(l.trim().slice(2)));
      pos++;
    }
    return arr;
  }

  // parse a block at >= minIndent; returns object or array
  function block(minIndent) {
    // decide array vs object by first line
    const first = lines[pos];
    const isList = first.trimStart().startsWith('- ');
    const out = isList ? [] : {};
    while (pos < lines.length) {
      const line = lines[pos];
      const ind = indentOf(line);
      if (ind < minIndent) break;
      if (ind > minIndent) { pos++; continue; }       // safety: skip deeper orphan lines
      const body = line.trim();
      if (body.startsWith('- ')) {
        out.push(scalar(body.slice(2)));
        pos++;
      } else {
        const ci = body.indexOf(':');
        const key = body.slice(0, ci).trim();
        const rest = body.slice(ci + 1).trim();
        pos++;
        if (rest === '') {
          // nested block — a deeper-indented map/list, OR a block list at this same indent.
          const next = lines[pos];
          const nextInd = next ? indentOf(next) : -1;
          if (next && nextInd > minIndent) out[key] = block(nextInd);
          else if (next && nextInd === minIndent && next.trim().startsWith('- ')) out[key] = listAt(minIndent);
          else out[key] = null;
        } else {
          out[key] = scalar(rest);
        }
      }
    }
    return out;
  }
  return lines.length ? block(indentOf(lines[0])) : {};
}

function load(taskDir) {
  const p = path.join(taskDir, 'task.yaml');
  if (!fs.existsSync(p)) return null;
  return parseYaml(fs.readFileSync(p, 'utf8'));
}

module.exports = { parseYaml, load };

// CLI: `node taskmeta.js <taskDir> [dotted.key]` — used by matrix.sh to read budgets/seeds.
if (require.main === module) {
  const meta = load(process.argv[2]) || {};
  const key = process.argv[3];
  if (!key) { process.stdout.write(JSON.stringify(meta)); process.exit(0); }
  let v = meta;
  for (const k of key.split('.')) v = v == null ? undefined : v[k];
  if (Array.isArray(v)) process.stdout.write(v.join(','));
  else if (v != null) process.stdout.write(String(v));
}
