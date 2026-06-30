#!/usr/bin/env node
// ollama-proxy.js — an ephemeral, per-run token-logging reverse proxy (Crucible P7).
//
// WHY: harnesses that drive a local model through their own runtime never surface
// token usage to the loop, so cost/efficiency can't be compared fairly. By routing the
// adapter's model traffic through this proxy (OLLAMA_HOST -> proxy), we meter exact
// prompt_eval_count / eval_count at the HTTP layer, regardless of whether the harness
// cooperates. loop.sh starts ONE proxy per run (tokens/trace files baked into argv) and
// kills it after, so attribution is per-run with zero correlation logic.
//
// Pass-through: request/response bytes are forwarded unchanged (streaming preserved);
// token accounting is a side effect computed from a tee'd copy of the response body.
//
// Usage:
//   node ollama-proxy.js --upstream http://localhost:11434 \
//        --tokens <file> --events <file.jsonl> --portfile <file> [--port 0]
//
// --tokens   cumulative "IN OUT" (single line), the format loop.sh's .tokens uses
// --events   one JSON line per upstream completion: {ts, model, tokens_in, tokens_out}
// --portfile written (atomically) once the server is listening, so loop.sh learns the port
'use strict';
const http = require('http');
const fs = require('fs');
const { URL } = require('url');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
const UPSTREAM = new URL(arg('upstream', 'http://localhost:11434'));
const TOKENS_FILE = arg('tokens', '');
const EVENTS_FILE = arg('events', '');
const PORTFILE = arg('portfile', '');
const PORT = parseInt(arg('port', '0'), 10);

let cumIn = 0, cumOut = 0;

// Parse token counts from a response body. Handles BOTH Ollama-native
// (prompt_eval_count/eval_count) and OpenAI-compatible (usage.prompt_tokens/
// completion_tokens) shapes, as a single stream:false object, an NDJSON stream, or an
// SSE stream ("data: {…}"). Takes the last meterable object in a stream.
function parseTokens(buf) {
  const text = buf.toString('utf8');
  const tryObj = s => { try { return JSON.parse(s); } catch { return null; } };
  const fromObj = o => {
    if (!o) return null;
    if (o.eval_count != null || o.prompt_eval_count != null)              // Ollama native
      return { model: o.model || null, in: o.prompt_eval_count || 0, out: o.eval_count || 0 };
    if (o.usage)                                                          // OpenAI-compatible
      return { model: o.model || null, in: o.usage.prompt_tokens || 0, out: o.usage.completion_tokens || 0 };
    return null;
  };
  const whole = fromObj(tryObj(text));
  if (whole) return whole;
  const lines = text.split('\n').map(l => l.replace(/^data:\s*/, '').trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const o = fromObj(tryObj(lines[i]));
    if (o) return o;
  }
  return null;
}

function record(t) {
  if (!t) return;
  cumIn += t.in; cumOut += t.out;
  if (TOKENS_FILE) { try { fs.writeFileSync(TOKENS_FILE, cumIn + ' ' + cumOut + '\n'); } catch {} }
  if (EVENTS_FILE) {
    try {
      fs.appendFileSync(EVENTS_FILE,
        JSON.stringify({ ts: new Date().toISOString(), model: t.model, tokens_in: t.in, tokens_out: t.out }) + '\n');
    } catch {}
  }
}

const server = http.createServer((creq, cres) => {
  if (creq.url === '/__crucible/health') { cres.writeHead(200); cres.end('ok'); return; }

  const opts = {
    protocol: UPSTREAM.protocol,
    hostname: UPSTREAM.hostname,
    port: UPSTREAM.port || 11434,
    method: creq.method,
    path: creq.url,
    headers: { ...creq.headers, host: UPSTREAM.host },
  };
  const ureq = http.request(opts, ures => {
    cres.writeHead(ures.statusCode || 502, ures.headers);
    const chunks = [];
    const meter = /\/(api|v1)\//.test(creq.url || '');   // Ollama-native or OpenAI-compat
    ures.on('data', d => { cres.write(d); if (meter) chunks.push(d); });
    ures.on('end', () => { cres.end(); if (meter && chunks.length) record(parseTokens(Buffer.concat(chunks))); });
    // a mid-stream upstream reset (Ollama restart/OOM) must not crash the proxy
    ures.on('error', () => { try { cres.end(); } catch {} });
  });
  ureq.on('error', e => { if (!cres.headersSent) cres.writeHead(502); try { cres.end('crucible-proxy upstream error: ' + e.message); } catch {} });
  // client disconnects / socket errors are non-fatal to the proxy
  creq.on('error', () => {});
  cres.on('error', () => {});
  creq.pipe(ureq);
});

server.listen(PORT, '127.0.0.1', () => {
  const port = server.address().port;
  if (PORTFILE) { try { fs.writeFileSync(PORTFILE + '.tmp', String(port)); fs.renameSync(PORTFILE + '.tmp', PORTFILE); } catch {} }
  process.stderr.write('crucible-proxy listening :' + port + ' -> ' + UPSTREAM.origin + '\n');
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { server.close(); } catch {} process.exit(0); });
