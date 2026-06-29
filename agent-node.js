#!/usr/bin/env node
// agent-node.js — the WORKER daemon. Deploy ONE per machine (local or remote).
//
// It exposes a tiny HTTP API the control plane (panel.js) calls to launch and
// inspect loop runs on THIS machine. This is how you "manage multiple agent
// instances running remotely": run an agent-node on each box (VPS, Pi, laptop),
// register them in the panel's nodes.json, and the panel fans out to them.
//
// Security: bind to 127.0.0.1 by default. For remote access, do NOT expose this
// to the internet directly — front it with an SSH tunnel (ssh -L) or a reverse
// proxy with TLS, and set AGENT_TOKEN so every request must carry the bearer.
//
//   AGENT_TOKEN=secret NODE_NAME=vps-1 PORT=7077 node agent-node.js
//
// Endpoints (all require `Authorization: Bearer $AGENT_TOKEN` if AGENT_TOKEN set):
//   GET  /health           -> { ok, node, hostname, adapters }
//   POST /run {task,adapter,maxIters} -> spawns ./loop.sh, returns { started, runId }
//   GET  /runs?limit=50     -> last N ledger entries from runs.jsonl
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 7077);
const HOST = process.env.BIND || '127.0.0.1';
const NODE_NAME = process.env.NODE_NAME || os.hostname();
const TOKEN = process.env.AGENT_TOKEN || '';

function adaptersAvailable() {
  return fs.readdirSync(path.join(ROOT, 'adapters'))
    .filter(f => f.endsWith('.sh')).map(f => f.replace('.sh', ''));
}
function readLedger(limit) {
  const p = path.join(ROOT, 'runs.jsonl');
  if (!fs.existsSync(p)) return [];
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
function authed(req) {
  if (!TOKEN) return true;
  return (req.headers.authorization || '') === `Bearer ${TOKEN}`;
}
function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); });
}

const running = new Map(); // runId -> child

const server = http.createServer(async (req, res) => {
  if (!authed(req)) return send(res, 401, { error: 'unauthorized' });
  const u = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && u.pathname === '/health') {
    return send(res, 200, { ok: true, node: NODE_NAME, hostname: os.hostname(),
      adapters: adaptersAvailable(), running: running.size, load: os.loadavg()[0] });
  }
  if (req.method === 'GET' && u.pathname === '/runs') {
    return send(res, 200, { node: NODE_NAME, runs: readLedger(Number(u.searchParams.get('limit') || 50)) });
  }
  if (req.method === 'POST' && u.pathname === '/run') {
    let b; try { b = JSON.parse(await body(req) || '{}'); } catch { return send(res, 400, { error: 'bad json' }); }
    const task = b.task || 'hello-sum';
    const adapter = b.adapter || 'mock';
    const maxIters = String(b.maxIters || 5);
    if (!adaptersAvailable().includes(adapter)) return send(res, 400, { error: `no adapter ${adapter}` });
    const runId = `${task}.${adapter}.${Date.now()}`;
    const child = spawn('bash', [path.join(ROOT, 'loop.sh'), `tasks/${task}`, adapter, maxIters],
      { cwd: ROOT, env: { ...process.env, NODE: NODE_NAME } });
    running.set(runId, child);
    let log = '';
    child.stdout.on('data', d => log += d); child.stderr.on('data', d => log += d);
    child.on('close', code => { running.delete(runId); });
    return send(res, 202, { started: true, runId, node: NODE_NAME, task, adapter });
  }
  send(res, 404, { error: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`agent-node "${NODE_NAME}" listening on http://${HOST}:${PORT}  (auth: ${TOKEN ? 'on' : 'OFF'})`);
  console.log(`adapters: ${adaptersAvailable().join(', ')}`);
});
