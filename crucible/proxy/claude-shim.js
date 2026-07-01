#!/usr/bin/env node
// claude-shim.js — expose the logged-in Claude Code session as a local model endpoint.
//
// WHY: Crucible's lean harnesses (ollama, aider, …) drive a model over Ollama's HTTP API
// (/api/generate, /api/chat) or the OpenAI-compatible /v1/chat/completions. They cannot speak
// the Anthropic Messages API. This shim answers those requests by shelling out to the
// authenticated `claude -p` CLI (tools OFF → a plain text completion), so we can benchmark
// (lean-harness × Claude) cells using the current logged-in session as the cloud model — no
// API key, no separate provider config.
//
// It returns tokens in BOTH Ollama-native (prompt_eval_count/eval_count) and OpenAI
// (usage.prompt_tokens/completion_tokens) shapes, so Crucible's metering proxy (which tees the
// response body) records real Claude usage. Input is counted incl. cache at full rate — the same
// deliberate UPPER bound claude.sh uses (no cache discount).
//
// Usage:
//   node claude-shim.js --portfile <file> [--port 0] [--model claude-opus-4-8]
//
// The harness points at Crucible's proxy; the proxy's --upstream points HERE (OLLAMA_UPSTREAM).
'use strict';
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
const fs = require('fs');
const PORT = parseInt(arg('port', '0'), 10);
const PORTFILE = arg('portfile', '');
const MODEL = arg('model', process.env.CLAUDE_SHIM_MODEL || 'claude-opus-4-8');
const CALL_TIMEOUT_MS = parseInt(process.env.CLAUDE_SHIM_TIMEOUT_MS || '180000', 10);

// A neutral cwd so `claude -p` never picks up the task's files as ambient project context
// (the harness already puts everything it wants the model to see in the prompt).
const NEUTRAL_CWD = fs.mkdtempSync(os.tmpdir() + '/claude-shim-');

const STEER =
  'You are being used as a raw code-generation model behind an automated coding harness. ' +
  'Respond ONLY with what the user\'s instructions and their requested output format require. ' +
  'Do not add explanations, preamble, or markdown code fences unless the format explicitly asks. ' +
  'Do not attempt to use tools; just produce the requested text.';

// Invoke `claude -p` as a one-shot completion. Resolves {text, inTok, outTok}.
function callClaude(promptText, systemText) {
  return new Promise(resolve => {
    const args = ['-p', '--output-format', 'json', '--allowedTools', '',
      '--model', MODEL, '--append-system-prompt', systemText ? (STEER + '\n\n' + systemText) : STEER];
    const child = spawn('claude', args, { cwd: NEUTRAL_CWD, env: process.env });
    let out = '', err = '';
    let done = false;
    const finish = (text, inTok, outTok) => { if (!done) { done = true; resolve({ text, inTok, outTok }); } };
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} finish('', 0, 0); }, CALL_TIMEOUT_MS);
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('error', () => { clearTimeout(timer); finish('', 0, 0); });
    child.on('close', () => {
      clearTimeout(timer);
      try {
        const j = JSON.parse(out);
        const u = j.usage || {};
        const inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
        const outTok = (u.output_tokens || 0);
        finish(typeof j.result === 'string' ? j.result : '', inTok, outTok);
      } catch {
        process.stderr.write('claude-shim: unparseable claude output; stderr=' + err.slice(0, 300) + '\n');
        finish('', 0, 0);
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(promptText || '');
  });
}

// Flatten an OpenAI/Ollama messages[] into (systemText, promptText).
function splitMessages(messages) {
  const sys = [], convo = [];
  for (const m of (messages || [])) {
    const content = typeof m.content === 'string' ? m.content
      : Array.isArray(m.content) ? m.content.map(p => (p && p.text) || '').join('') : '';
    if (m.role === 'system') sys.push(content);
    else convo.push((m.role === 'assistant' ? 'Assistant: ' : m.role === 'user' ? '' : m.role + ': ') + content);
  }
  return { systemText: sys.join('\n\n'), promptText: convo.join('\n\n') };
}

function readBody(req) {
  return new Promise(resolve => { let b = ''; req.on('data', d => b += d); req.on('end', () => resolve(b)); });
}
function sendJSON(res, obj, code = 200) {
  const s = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(s);
}
const nowISO = () => new Date().toISOString();

const server = http.createServer(async (req, res) => {
  const url = (req.url || '').split('?')[0];
  try {
    // --- model discovery (aider/ollama probe these) ---
    if (req.method === 'GET' && url === '/api/tags') {
      return sendJSON(res, { models: [{ name: MODEL, model: MODEL, modified_at: nowISO(), size: 0, digest: 'claude-shim', details: { family: 'claude', parameter_size: 'cloud' } }] });
    }
    if (req.method === 'GET' && (url === '/api/version')) return sendJSON(res, { version: '0.0.0-claude-shim' });
    if (req.method === 'POST' && url === '/api/show') {
      return sendJSON(res, { license: 'proprietary', details: { family: 'claude', parameter_size: 'cloud' }, model_info: {}, capabilities: ['completion'] });
    }
    if (req.method === 'GET' && url === '/v1/models') {
      return sendJSON(res, { object: 'list', data: [{ id: MODEL, object: 'model', owned_by: 'anthropic' }] });
    }
    if (url === '/__crucible/health') { res.writeHead(200); return res.end('ok'); }

    const body = await readBody(req);
    const reqObj = body ? JSON.parse(body) : {};
    const wantStream = reqObj.stream === true;

    // --- Ollama native: /api/generate (single prompt) ---
    if (req.method === 'POST' && url === '/api/generate') {
      const { text, inTok, outTok } = await callClaude(reqObj.prompt || '', reqObj.system || '');
      const base = { model: reqObj.model || MODEL, created_at: nowISO() };
      if (wantStream) {
        res.writeHead(200, { 'content-type': 'application/x-ndjson' });
        res.write(JSON.stringify({ ...base, response: text, done: false }) + '\n');
        res.end(JSON.stringify({ ...base, response: '', done: true, prompt_eval_count: inTok, eval_count: outTok }) + '\n');
        return;
      }
      return sendJSON(res, { ...base, response: text, done: true, prompt_eval_count: inTok, eval_count: outTok });
    }

    // --- Ollama native: /api/chat (messages) ---
    if (req.method === 'POST' && url === '/api/chat') {
      const { systemText, promptText } = splitMessages(reqObj.messages);
      const { text, inTok, outTok } = await callClaude(promptText, systemText);
      const base = { model: reqObj.model || MODEL, created_at: nowISO() };
      if (wantStream) {
        res.writeHead(200, { 'content-type': 'application/x-ndjson' });
        res.write(JSON.stringify({ ...base, message: { role: 'assistant', content: text }, done: false }) + '\n');
        res.end(JSON.stringify({ ...base, message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: inTok, eval_count: outTok }) + '\n');
        return;
      }
      return sendJSON(res, { ...base, message: { role: 'assistant', content: text }, done: true, prompt_eval_count: inTok, eval_count: outTok });
    }

    // --- OpenAI-compatible: /v1/chat/completions ---
    if (req.method === 'POST' && (url === '/v1/chat/completions' || url === '/chat/completions')) {
      const { systemText, promptText } = splitMessages(reqObj.messages);
      const { text, inTok, outTok } = await callClaude(promptText, systemText);
      const id = 'chatcmpl-shim';
      const created = Math.floor(Date.parse(nowISO()) / 1000);
      const usage = { prompt_tokens: inTok, completion_tokens: outTok, total_tokens: inTok + outTok };
      if (wantStream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created, model: reqObj.model || MODEL, choices: [{ index: 0, delta: { role: 'assistant', content: text }, finish_reason: null }] }) + '\n\n');
        res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created, model: reqObj.model || MODEL, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage }) + '\n\n');
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      return sendJSON(res, { id, object: 'chat.completion', created, model: reqObj.model || MODEL,
        choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }], usage });
    }

    res.writeHead(404); res.end('claude-shim: no route ' + url);
  } catch (e) {
    if (!res.headersSent) res.writeHead(500);
    try { res.end('claude-shim error: ' + e.message); } catch {}
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const port = server.address().port;
  if (PORTFILE) { try { fs.writeFileSync(PORTFILE + '.tmp', String(port)); fs.renameSync(PORTFILE + '.tmp', PORTFILE); } catch {} }
  process.stderr.write('claude-shim listening :' + port + '  model=' + MODEL + '\n');
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { server.close(); } catch {} process.exit(0); });
