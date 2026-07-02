#!/usr/bin/env node
// anthropic-shim.js — expose the Anthropic Messages API as an OpenAI/Ollama-compatible endpoint
// **with tool-calling**, so Crucible's TOOL-CALLING harnesses (pi/hermes/goose) can drive a cloud
// Claude model. This closes the §6.4 gap that the OAuth `claude-shim` cannot: a plain `claude -p`
// completion can only emit text, but a tool-calling harness needs the model to emit structured
// tool-calls — which the Messages API produces. Requires ANTHROPIC_API_KEY (a real API key, not
// the subscription/OAuth login).
//
// Wiring (metering unchanged): harness → Crucible ollama-proxy (meters /v1 usage) → THIS shim → api.anthropic.com
//   ANTHROPIC_API_KEY=… node crucible/proxy/anthropic-shim.js --portfile /tmp/ashim.port &
//   CRUCIBLE=1 HARNESS_MODEL=claude-opus-4-8 OLLAMA_UPSTREAM="http://127.0.0.1:$(cat /tmp/ashim.port)" \
//     ./loop.sh crucible/tasks/tool-recover pi 6
//
// Tokens are returned in BOTH OpenAI (usage.*) and Ollama (prompt_eval_count/eval_count) shapes so
// Crucible's metering proxy records real usage; input counts cache at full rate (the same upper
// bound claude-shim / claude.sh use). The translation functions are pure + exported and unit-tested
// (test/anthropic-shim.test.js); the HTTP server runs only when this file is invoked directly.
'use strict';
const https = require('https');

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = parseInt(process.env.ANTHROPIC_SHIM_MAX_TOKENS || '4096', 10);
const TIMEOUT_MS = parseInt(process.env.ANTHROPIC_SHIM_TIMEOUT_MS || '180000', 10);

const textOf = c => typeof c === 'string' ? c
  : Array.isArray(c) ? c.map(p => (p && (p.text ?? p.content)) || '').join('')
  : (c == null ? '' : String(c));

// ---- translation: OpenAI/Ollama chat request -> Anthropic Messages request -------------------
function toAnthropic(req, defaultModel) {
  const sys = [];
  const messages = [];
  let pendingTR = null;                          // group consecutive tool results into one user turn
  const flushTR = () => { if (pendingTR) { messages.push({ role: 'user', content: pendingTR }); pendingTR = null; } };

  for (const m of (req.messages || [])) {
    if (m.role === 'system') { flushTR(); sys.push(textOf(m.content)); continue; }
    if (m.role === 'tool') {                     // OpenAI/Ollama tool result -> Anthropic tool_result block
      (pendingTR ||= []).push({ type: 'tool_result', tool_use_id: m.tool_call_id || m.tool_use_id || '', content: textOf(m.content) });
      continue;
    }
    flushTR();
    if (m.role === 'assistant') {
      const content = [];
      const t = textOf(m.content);
      if (t) content.push({ type: 'text', text: t });
      for (const tc of (m.tool_calls || [])) {
        const fn = tc.function || tc;
        let input = {};
        const raw = fn.arguments;
        try { input = typeof raw === 'string' ? (raw ? JSON.parse(raw) : {}) : (raw || {}); } catch { input = {}; }
        content.push({ type: 'tool_use', id: tc.id || ('call_' + (fn.name || 'tool')), name: fn.name, input });
      }
      messages.push({ role: 'assistant', content: content.length ? content : [{ type: 'text', text: '' }] });
    } else {                                      // user (and any unknown role) -> user text
      messages.push({ role: 'user', content: textOf(m.content) });
    }
  }
  flushTR();

  const out = {
    model: (req.model && String(req.model).startsWith('claude')) ? req.model : defaultModel,
    max_tokens: req.max_tokens || DEFAULT_MAX_TOKENS,
    messages,
  };
  if (sys.length) out.system = sys.join('\n\n');
  if (typeof req.temperature === 'number') out.temperature = req.temperature;
  if (typeof req.top_p === 'number') out.top_p = req.top_p;

  const tools = (req.tools || []).map(t => {
    const fn = t.function || t;                   // OpenAI {type:function,function:{…}} == Ollama shape
    return { name: fn.name, description: fn.description || '', input_schema: fn.parameters || fn.input_schema || { type: 'object', properties: {} } };
  }).filter(t => t.name);
  if (tools.length) {
    const tc = req.tool_choice;
    if (tc === 'none') { /* forbid tool use: Anthropic has no 'none', so omit tools entirely */ }
    else {
      out.tools = tools;
      if (tc === 'required' || tc === 'any') out.tool_choice = { type: 'any' };
      else if (tc && tc.function && tc.function.name) out.tool_choice = { type: 'tool', name: tc.function.name };
      else out.tool_choice = { type: 'auto' };
    }
  }
  return out;
}

// ---- translation: Anthropic response -> OpenAI / Ollama --------------------------------------
function usageOf(resp) {
  const u = (resp && resp.usage) || {};
  return {
    inTok: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
    outTok: (u.output_tokens || 0),
  };
}
function splitContent(resp) {
  let text = ''; const toolCalls = [];
  for (const b of ((resp && resp.content) || [])) {
    if (b.type === 'text') text += b.text || '';
    else if (b.type === 'tool_use') toolCalls.push({ id: b.id, name: b.name, input: b.input || {} });
  }
  return { text, toolCalls };
}
const FINISH = sr => sr === 'tool_use' ? 'tool_calls' : sr === 'max_tokens' ? 'length' : 'stop';

function toOpenAI(resp, model) {
  const { text, toolCalls } = splitContent(resp);
  const { inTok, outTok } = usageOf(resp);
  const message = { role: 'assistant', content: text || (toolCalls.length ? null : '') };
  if (toolCalls.length) message.tool_calls = toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.input) } }));
  return {
    id: 'chatcmpl-' + (resp.id || 'ashim'), object: 'chat.completion',
    created: Math.floor(Date.now() / 1000), model: model || resp.model,
    choices: [{ index: 0, message, finish_reason: FINISH(resp.stop_reason) }],
    usage: { prompt_tokens: inTok, completion_tokens: outTok, total_tokens: inTok + outTok },
  };
}
function toOllama(resp, model) {
  const { text, toolCalls } = splitContent(resp);
  const { inTok, outTok } = usageOf(resp);
  const message = { role: 'assistant', content: text };
  if (toolCalls.length) message.tool_calls = toolCalls.map(tc => ({ function: { name: tc.name, arguments: tc.input || {} } }));  // Ollama: arguments is an OBJECT
  return { model, created_at: new Date().toISOString(), message, done: true, done_reason: FINISH(resp.stop_reason), prompt_eval_count: inTok, eval_count: outTok };
}

module.exports = { toAnthropic, toOpenAI, toOllama, splitContent, usageOf };

// ---- HTTP server (only when run directly) ----------------------------------------------------
if (require.main === module) {
  const http = require('http');
  const fs = require('fs');
  const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def; };
  const PORT = parseInt(arg('port', '0'), 10);
  const PORTFILE = arg('portfile', '');
  const MODEL = arg('model', process.env.ANTHROPIC_SHIM_MODEL || 'claude-opus-4-8');

  function callAnthropic(anthReq) {
    return new Promise(resolve => {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return resolve({ error: 'ANTHROPIC_API_KEY not set' });
      const payload = JSON.stringify(anthReq);
      const r = https.request({
        hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'content-length': Buffer.byteLength(payload) },
      }, resp => {
        let d = ''; resp.on('data', c => d += c);
        resp.on('end', () => {
          try { const j = JSON.parse(d); if (resp.statusCode >= 400) return resolve({ error: (j.error && j.error.message) || ('HTTP ' + resp.statusCode) }); resolve(j); }
          catch { resolve({ error: 'unparseable anthropic response: ' + d.slice(0, 200) }); }
        });
      });
      r.on('error', e => resolve({ error: e.message }));
      r.setTimeout(TIMEOUT_MS, () => { try { r.destroy(); } catch {} resolve({ error: 'anthropic call timeout' }); });
      r.end(payload);
    });
  }
  const readBody = req => new Promise(resolve => { let b = ''; req.on('data', d => b += d); req.on('end', () => resolve(b)); });
  const sendJSON = (res, obj, code = 200, hdr = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...hdr }); res.end(JSON.stringify(obj)); };
  const nowISO = () => new Date().toISOString();
  // On an upstream error, return a well-formed EMPTY completion (0 tokens) + an error header, so the
  // harness sees "no tool-call / no text" and fails the cell cleanly instead of crashing the loop.
  const emptyAnthropic = err => ({ id: 'err', content: [], stop_reason: 'end_turn', usage: {}, _err: err });

  const server = http.createServer(async (req, res) => {
    const url = (req.url || '').split('?')[0];
    try {
      if (req.method === 'GET' && url === '/api/tags') return sendJSON(res, { models: [{ name: MODEL, model: MODEL, modified_at: nowISO(), size: 0, digest: 'anthropic-shim', details: { family: 'claude', parameter_size: 'cloud' } }] });
      if (req.method === 'GET' && url === '/api/version') return sendJSON(res, { version: '0.0.0-anthropic-shim' });
      if (req.method === 'POST' && url === '/api/show') return sendJSON(res, { license: 'proprietary', details: { family: 'claude', parameter_size: 'cloud' }, model_info: {}, capabilities: ['completion', 'tools'] });
      if (req.method === 'GET' && url === '/v1/models') return sendJSON(res, { object: 'list', data: [{ id: MODEL, object: 'model', owned_by: 'anthropic' }] });
      if (url === '/__crucible/health') { res.writeHead(200); return res.end('ok'); }

      const reqObj = await readBody(req).then(b => b ? JSON.parse(b) : {});
      const wantStream = reqObj.stream === true;

      // OpenAI-compatible: /v1/chat/completions (pi/hermes redirect their base_url here)
      if (req.method === 'POST' && (url === '/v1/chat/completions' || url === '/chat/completions')) {
        const resp = await callAnthropic(toAnthropic(reqObj, MODEL));
        const errHdr = resp.error ? { 'x-ashim-error': String(resp.error).slice(0, 200) } : {};
        if (resp.error) process.stderr.write('anthropic-shim: ' + resp.error + '\n');
        const oai = toOpenAI(resp.error ? emptyAnthropic(resp.error) : resp, reqObj.model || MODEL);
        if (wantStream) {
          res.writeHead(200, { 'content-type': 'text/event-stream', ...errHdr });
          const ch = oai.choices[0];
          res.write('data: ' + JSON.stringify({ id: oai.id, object: 'chat.completion.chunk', created: oai.created, model: oai.model, choices: [{ index: 0, delta: { role: 'assistant', content: ch.message.content, ...(ch.message.tool_calls ? { tool_calls: ch.message.tool_calls.map((t, i) => ({ index: i, ...t })) } : {}) }, finish_reason: null }] }) + '\n\n');
          res.write('data: ' + JSON.stringify({ id: oai.id, object: 'chat.completion.chunk', created: oai.created, model: oai.model, choices: [{ index: 0, delta: {}, finish_reason: ch.finish_reason }], usage: oai.usage }) + '\n\n');
          res.write('data: [DONE]\n\n'); return res.end();
        }
        return sendJSON(res, oai, 200, errHdr);
      }

      // Ollama-native: /api/chat (goose and Ollama-tool clients)
      if (req.method === 'POST' && url === '/api/chat') {
        const resp = await callAnthropic(toAnthropic(reqObj, MODEL));
        if (resp.error) process.stderr.write('anthropic-shim: ' + resp.error + '\n');
        const oll = toOllama(resp.error ? emptyAnthropic(resp.error) : resp, reqObj.model || MODEL);
        if (wantStream) {
          res.writeHead(200, { 'content-type': 'application/x-ndjson' });
          res.write(JSON.stringify({ ...oll, done: false }) + '\n');
          res.end(JSON.stringify(oll) + '\n'); return;
        }
        return sendJSON(res, oll);
      }

      // Ollama-native: /api/generate (no tools — plain prompt)
      if (req.method === 'POST' && url === '/api/generate') {
        const resp = await callAnthropic(toAnthropic({ messages: [{ role: 'user', content: reqObj.prompt || '' }], system: reqObj.system }, MODEL));
        if (resp.error) process.stderr.write('anthropic-shim: ' + resp.error + '\n');
        const { text } = splitContent(resp.error ? emptyAnthropic(resp.error) : resp);
        const { inTok, outTok } = usageOf(resp.error ? {} : resp);
        return sendJSON(res, { model: reqObj.model || MODEL, created_at: nowISO(), response: text, done: true, prompt_eval_count: inTok, eval_count: outTok });
      }

      res.writeHead(404); res.end('anthropic-shim: no route ' + url);
    } catch (e) {
      if (!res.headersSent) res.writeHead(500);
      try { res.end('anthropic-shim error: ' + e.message); } catch {}
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    const port = server.address().port;
    if (PORTFILE) { try { fs.writeFileSync(PORTFILE + '.tmp', String(port)); fs.renameSync(PORTFILE + '.tmp', PORTFILE); } catch {} }
    if (!process.env.ANTHROPIC_API_KEY) process.stderr.write('anthropic-shim: WARNING ANTHROPIC_API_KEY not set — calls will return empty.\n');
    process.stderr.write('anthropic-shim listening :' + port + '  model=' + MODEL + '  (tool-calling enabled)\n');
  });
}
