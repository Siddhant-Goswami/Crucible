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
const https = require('https');
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
    // /v1/responses streams SSE; the terminal `response.completed` event nests usage under
    // `.response.usage`. Unwrap it so streamed codex/Responses traffic is metered too.
    if (o.usage == null && o.response && o.response.usage) o = { model: o.response.model, usage: o.response.usage };
    if (o.eval_count != null || o.prompt_eval_count != null)              // Ollama native
      return { model: o.model || null, in: o.prompt_eval_count || 0, out: o.eval_count || 0 };
    if (o.usage) {                                                        // OpenAI-compatible
      const u = o.usage;
      // /v1/chat/completions & /v1/completions use prompt_tokens/completion_tokens; /v1/responses
      // (Codex's wire API) uses input_tokens/output_tokens. Accept both so codex — long an
      // unmetered blind spot — is metered when pointed at the proxy via a custom Responses provider.
      const tin = u.prompt_tokens ?? u.input_tokens ?? 0;
      const tout = u.completion_tokens ?? u.output_tokens ?? 0;
      return { model: o.model || null, in: tin, out: tout };
    }
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

  const isHttps = UPSTREAM.protocol === 'https:';
  // Strip accept-encoding so the upstream returns identity-encoded bodies — otherwise a
  // gzip/deflate response would be parsed as raw UTF-8 and yield no token counts.
  const headers = { ...creq.headers, host: UPSTREAM.host };
  delete headers['accept-encoding'];
  // OVERRIDE the auth header when forwarding to OpenAI. Harnesses that reach a cloud model through
  // their local "ollama" provider carry no real key — pi even sends a literal `Bearer ollama`
  // placeholder — so their requests 401 at OpenAI and read 0 tokens. The proxy holds the real key
  // (inherited from the run env) and replaces whatever placeholder they sent, so every OpenAI-
  // dialect harness is metered uniformly. Scoped to the openai.com upstream so a local-Ollama run
  // never receives a stray Authorization header.
  if (/(^|\.)openai\.com$/.test(UPSTREAM.hostname) && process.env.OPENAI_API_KEY) {
    delete headers.Authorization;
    headers.authorization = 'Bearer ' + process.env.OPENAI_API_KEY;
  }
  const opts = {
    protocol: UPSTREAM.protocol,
    hostname: UPSTREAM.hostname,
    port: UPSTREAM.port || (isHttps ? 443 : 11434),
    method: creq.method,
    path: creq.url,
    headers,
  };
  const onUpstream = ures => {
    cres.writeHead(ures.statusCode || 502, ures.headers);
    const chunks = [];
    const meter = /\/(api|v1)\//.test(creq.url || '');   // Ollama-native or OpenAI-compat
    ures.on('data', d => { cres.write(d); if (meter) chunks.push(d); });
    ures.on('end', () => { cres.end(); if (meter && chunks.length) record(parseTokens(Buffer.concat(chunks))); });
    // a mid-stream upstream reset (Ollama restart/OOM) must not crash the proxy
    ures.on('error', () => { try { cres.end(); } catch {} });
  };
  const onUerr = e => { if (!cres.headersSent) cres.writeHead(502); try { cres.end('crucible-proxy upstream error: ' + e.message); } catch {} };
  // client disconnects / socket errors are non-fatal to the proxy
  creq.on('error', () => {});
  cres.on('error', () => {});

  // Think-mode pinning (CRZ_THINK=true|false): the EFFECTIVE reasoning mode of a served model is
  // whatever the serving default is, which silently varies by model/template — a battery cell is
  // only attributable if the mode is pinned per run. When set, buffer generation-request bodies
  // and inject `think` uniformly for every harness; unset = passthrough (byte-identical behavior).
  const THINK = process.env.CRZ_THINK || '';
  const genPath = /\/api\/(chat|generate)|\/v1\/(chat\/completions|completions|responses)/.test(creq.url || '');
  if ((THINK === 'true' || THINK === 'false') && creq.method === 'POST' && genPath) {
    const bufs = [];
    creq.on('data', d => bufs.push(d));
    creq.on('end', () => {
      let body = Buffer.concat(bufs);
      try {
        const o = JSON.parse(body.toString('utf8'));
        if (/^\/v1\//.test(creq.url || '')) {
          // Ollama's OpenAI-compat endpoints ignore `think`; they honor reasoning_effort
          // ("none" verified to suppress reasoning on qwen3.5, 2026-07-02).
          o.reasoning_effort = THINK === 'true' ? 'high' : 'none';
        } else {
          o.think = THINK === 'true';
        }
        body = Buffer.from(JSON.stringify(o));
      } catch {}   // non-JSON body: forward untouched
      const h = { ...opts.headers, 'content-length': Buffer.byteLength(body) };
      delete h['transfer-encoding'];
      const u = (isHttps ? https : http).request({ ...opts, headers: h }, onUpstream);
      u.on('error', onUerr);
      u.end(body);
    });
    return;
  }

  const ureq = (isHttps ? https : http).request(opts, onUpstream);
  ureq.on('error', onUerr);
  creq.pipe(ureq);
});

// Only bind the port when run as a CLI; `require()` (unit tests) gets the pure helpers instead.
if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    const port = server.address().port;
    if (PORTFILE) { try { fs.writeFileSync(PORTFILE + '.tmp', String(port)); fs.renameSync(PORTFILE + '.tmp', PORTFILE); } catch {} }
    process.stderr.write('crucible-proxy listening :' + port + ' -> ' + UPSTREAM.origin + '\n');
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { server.close(); } catch {} process.exit(0); });
}

module.exports = { parseTokens };
