#!/usr/bin/env node
// panel.js — the ADMIN MASTER CONTROL PANEL (control plane).
//
// One dashboard to manage and control every agent instance — local and remote.
// It reads nodes.json, shows each node's health, lets you launch a loop on any
// node (local in-process, or a remote agent-node.js over HTTP), tails the merged
// run ledger, and shows live cost. The Telegram bot (telegram-bot.js) drives the
// exact same HTTP API, so chat and dashboard stay in sync.
//
//   node panel.js            # http://127.0.0.1:8088
//
// Architecture:
//   panel.js (control plane)  ──HTTP──>  agent-node.js on vps-1, vps-2, ...
//        │ local kind                         │ each runs ./loop.sh <task> <adapter>
//        └ spawns ./loop.sh directly          └ appends to its own runs.jsonl
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8088);
const HOST = process.env.BIND || '127.0.0.1';
const nodesCfg = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'nodes.json'), 'utf8')).nodes;
const pricing = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'pricing.json'), 'utf8'));

const tasks = () => fs.readdirSync(path.join(ROOT, 'tasks')).filter(f =>
  fs.existsSync(path.join(ROOT, 'tasks', f, 'verify.sh')));
const adapters = () => fs.readdirSync(path.join(ROOT, 'adapters')).filter(f => f.endsWith('.sh')).map(f => f.replace('.sh', ''));
const readLedger = (limit = 50) => {
  const p = path.join(ROOT, 'runs.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).slice(-limit).reverse();
};
const headers = node => node.token ? { authorization: `Bearer ${node.token}` } : {};

async function nodeHealth(node) {
  if (node.kind === 'local') return { name: node.name, kind: 'local', ok: true, adapters: adapters() };
  try {
    const r = await fetch(`${node.url}/health`, { headers: headers(node), signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    return { name: node.name, kind: 'http', url: node.url, ok: !!j.ok, ...j };
  } catch (e) { return { name: node.name, kind: 'http', url: node.url, ok: false, error: String(e.message || e) }; }
}

function launchLocal(task, adapter, maxIters) {
  const runId = `${task}.${adapter}.${Date.now()}`;
  const child = spawn('bash', [path.join(ROOT, 'loop.sh'), `tasks/${task}`, adapter, String(maxIters || 5)],
    { cwd: ROOT, env: { ...process.env, NODE: 'local' } });
  child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
  return { started: true, runId, node: 'local', task, adapter };
}

function costSummary() {
  const p = pricing(); const runs = readLedger(500);
  const by = {}; let totalUsd = 0;
  for (const r of runs) {
    const model = p.adapterModel[r.adapter] || 'ollama/qwen3:8b';
    const pr = p.models[model] || { in: 0, out: 0 };
    const usd = ((r.tokens_in || 0) * pr.in + (r.tokens_out || 0) * pr.out) / 1e6;
    const a = (by[r.adapter] ||= { runs: 0, usd: 0, model }); a.runs++; a.usd += usd; totalUsd += usd;
  }
  return { runs: runs.length, totalUsd, byAdapter: by };
}

const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); });

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && u.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(DASHBOARD);
  }
  if (req.method === 'GET' && u.pathname === '/api/meta') {
    return send(res, 200, { tasks: tasks(), adapters: adapters(), nodes: nodesCfg().map(n => n.name) });
  }
  if (req.method === 'GET' && u.pathname === '/api/nodes') {
    return send(res, 200, { nodes: await Promise.all(nodesCfg().map(nodeHealth)) });
  }
  if (req.method === 'GET' && u.pathname === '/api/runs') {
    return send(res, 200, { runs: readLedger(Number(u.searchParams.get('limit') || 40)) });
  }
  if (req.method === 'GET' && u.pathname === '/api/cost') {
    return send(res, 200, costSummary());
  }
  if (req.method === 'POST' && u.pathname === '/api/run') {
    let b; try { b = JSON.parse(await body(req) || '{}'); } catch { return send(res, 400, { error: 'bad json' }); }
    const node = nodesCfg().find(n => n.name === (b.node || 'local'));
    if (!node) return send(res, 400, { error: `unknown node ${b.node}` });
    if (node.kind === 'local') return send(res, 202, launchLocal(b.task, b.adapter, b.maxIters));
    try {
      const r = await fetch(`${node.url}/run`, { method: 'POST',
        headers: { 'content-type': 'application/json', ...headers(node) }, body: JSON.stringify(b),
        signal: AbortSignal.timeout(5000) });
      return send(res, 202, await r.json());
    } catch (e) { return send(res, 502, { error: `node ${node.name} unreachable: ${e.message}` }); }
  }
  send(res, 404, { error: 'not found' });
});

const DASHBOARD = `<!doctype html><html><head><meta charset=utf8><title>nemo-claw control panel</title>
<style>
 body{background:#0d1117;color:#c9d1d9;font:14px/1.5 ui-monospace,Menlo,monospace;margin:0;padding:24px;max-width:1100px;margin:auto}
 h1{font-size:18px;color:#58a6ff;margin:0 0 4px} .sub{color:#8b949e;margin-bottom:20px}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:20px}
 .card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px}
 .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}
 .ok{background:#3fb950}.bad{background:#f85149}
 .muted{color:#8b949e;font-size:12px} h2{font-size:14px;color:#58a6ff;margin:20px 0 8px}
 select,button{background:#21262d;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;padding:7px 10px;font:inherit}
 button{background:#238636;border-color:#2ea043;cursor:pointer;font-weight:600}button:hover{background:#2ea043}
 table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:5px 8px;border-bottom:1px solid #21262d}
 th{color:#8b949e;font-weight:600} .pass{color:#3fb950}.fail{color:#f85149} .big{font-size:22px;color:#e6edf3}
 form{display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px}
</style></head><body>
<h1>🦞 nemo-claw — agent control panel</h1>
<div class=sub>Manage &amp; control loop-driven agent instances across local and remote nodes.</div>

<h2>Nodes</h2><div id=nodes class=grid></div>

<h2>Launch a loop</h2>
<form id=launch>
 <label>node <select id=node></select></label>
 <label>task <select id=task></select></label>
 <label>adapter <select id=adapter></select></label>
 <button type=submit>▶ Run</button>
 <span id=launchmsg class=muted></span>
</form>

<h2>Cost (from measured tokens)</h2>
<div class=card><span id=cost class=muted>…</span></div>

<h2>Recent runs</h2>
<table><thead><tr><th>time</th><th>node</th><th>task</th><th>adapter</th><th>result</th><th>iters</th><th>ms</th><th>tok in/out</th></tr></thead>
<tbody id=runs></tbody></table>

<script>
const j = (u,o)=>fetch(u,o).then(r=>r.json());
async function meta(){const m=await j('/api/meta');
 sel('node',m.nodes);sel('task',m.tasks);sel('adapter',m.adapters);}
function sel(id,arr){const s=document.getElementById(id);s.innerHTML=arr.map(x=>'<option>'+x+'</option>').join('')}
async function nodes(){const {nodes}=await j('/api/nodes');
 document.getElementById('nodes').innerHTML=nodes.map(n=>
  '<div class=card><div><span class="dot '+(n.ok?'ok':'bad')+'"></span><b>'+n.name+'</b> <span class=muted>'+n.kind+'</span></div>'+
  '<div class=muted>'+(n.ok?('adapters: '+(n.adapters||[]).length+(n.running!=null?' · running '+n.running:'')+(n.load!=null?' · load '+n.load.toFixed(2):'')):('down: '+(n.error||'')))+'</div></div>').join('')}
async function runs(){const {runs}=await j('/api/runs?limit=25');
 document.getElementById('runs').innerHTML=runs.map(r=>'<tr><td class=muted>'+(r.ts||'').replace('T',' ').slice(5,19)+'</td><td>'+r.node+'</td><td>'+r.task+'</td><td>'+r.adapter+'</td>'+
  '<td class="'+(r.result==='passed'?'pass':'fail')+'">'+r.result+'</td><td>'+r.iterations+'</td><td>'+r.wall_ms+'</td><td class=muted>'+(r.tokens_in||0)+'/'+(r.tokens_out||0)+'</td></tr>').join('')}
async function cost(){const c=await j('/api/cost');
 const rows=Object.entries(c.byAdapter||{}).map(([a,v])=>a+': '+v.runs+' runs, $'+v.usd.toFixed(6)+' ('+v.model+')').join(' · ');
 document.getElementById('cost').innerHTML='<span class=big>$'+c.totalUsd.toFixed(6)+'</span> across '+c.runs+' runs &nbsp; <span class=muted>'+rows+'</span>'}
document.getElementById('launch').onsubmit=async e=>{e.preventDefault();
 const b={node:node.value,task:task.value,adapter:adapter.value};
 const r=await j('/api/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});
 document.getElementById('launchmsg').textContent=r.error?('✗ '+r.error):('✓ started '+(r.runId||''));
 setTimeout(refresh,1200)}
function refresh(){nodes();runs();cost()}
meta();refresh();setInterval(refresh,3000);
</script></body></html>`;

server.listen(PORT, HOST, () => console.log(`control panel: http://${HOST}:${PORT}`));
