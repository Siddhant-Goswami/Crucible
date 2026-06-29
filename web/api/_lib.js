// _lib.js — shared helpers for the Vercel serverless control plane.
// (Underscore prefix => not treated as a route.)
//
// Config comes from ENV (Vercel project settings), never the filesystem:
//   NODES         JSON array of public agent-node daemons, e.g.
//                 [{"name":"vps-1","url":"https://agents.example.com","token":"abc"}]
//                 Node tokens stay server-side — never sent to the browser.
//   PANEL_TOKEN   shared secret; when set, every API call must send it as the
//                 x-panel-token header (the dashboard prompts for it once).
//
// With no NODES configured the panel runs in READ-ONLY DEMO mode: GETs return
// sample data so the dashboard renders, and /run is disabled (no execution).

const PRICING = {
  models: {
    'ollama/qwen3:8b': { in: 0, out: 0 },
    'claude-opus-4-8': { in: 5.0, out: 25.0 },
    'claude-sonnet-4-6': { in: 3.0, out: 15.0 },
    'claude-haiku-4-5': { in: 1.0, out: 5.0 },
    'claude-fable-5': { in: 10.0, out: 50.0 }
  },
  // Keep in sync with pricing.json `adapterModel`: every lean harness
  // (hermes/openclaw/pi/goose) is wired to the SAME local Ollama qwen3:8b as the
  // `ollama` adapter, so they price to $0 — only `claude` runs a cloud model.
  adapterModel: {
    mock: 'ollama/qwen3:8b', ollama: 'ollama/qwen3:8b',
    hermes: 'ollama/qwen3:8b', openclaw: 'ollama/qwen3:8b',
    pi: 'ollama/qwen3:8b', goose: 'ollama/qwen3:8b',
    claude: 'claude-opus-4-8', nemo: 'ollama/qwen3:8b'
  }
};

const DEMO_NODES = [
  { name: 'demo-vps (sample)', kind: 'http', ok: true, demo: true,
    adapters: ['mock', 'ollama', 'claude', 'hermes', 'nemo'], running: 0, load: 0.12 }
];

// Sample ledger so the dashboard + cost model show real numbers in demo mode.
const DEMO_RUNS = [
  { ts: '2026-06-29T05:40:11.000Z', node: 'demo-vps', task: 'hello-sum', adapter: 'ollama', result: 'passed', iterations: 1, wall_ms: 1781, tokens_in: 213, tokens_out: 27 },
  { ts: '2026-06-29T05:39:54.000Z', node: 'demo-vps', task: 'hello-sum', adapter: 'mock',   result: 'passed', iterations: 1, wall_ms: 556,  tokens_in: 0,   tokens_out: 0 },
  { ts: '2026-06-29T05:39:30.000Z', node: 'demo-vps', task: 'hello-sum', adapter: 'claude', result: 'passed', iterations: 2, wall_ms: 9120, tokens_in: 612, tokens_out: 184 },
  { ts: '2026-06-29T05:38:02.000Z', node: 'demo-vps', task: 'grading',   adapter: 'ollama', result: 'failed', iterations: 3, wall_ms: 24310, tokens_in: 2940, tokens_out: 410 }
];

const getNodes = () => { try { return JSON.parse(process.env.NODES || '[]'); } catch { return []; } };
const isDemo = () => getNodes().length === 0;
const hasPanelToken = () => !!process.env.PANEL_TOKEN;
const authed = (req) => !hasPanelToken() || (req.headers['x-panel-token'] === process.env.PANEL_TOKEN);
const nodeHeaders = (node) => node.token ? { authorization: `Bearer ${node.token}` } : {};

function priceRuns(runs) {
  const by = {}; let totalUsd = 0;
  for (const r of runs) {
    const model = PRICING.adapterModel[r.adapter] || 'ollama/qwen3:8b';
    const p = PRICING.models[model] || { in: 0, out: 0 };
    const usd = ((r.tokens_in || 0) * p.in + (r.tokens_out || 0) * p.out) / 1e6;
    const a = (by[r.adapter] ||= { runs: 0, usd: 0, model }); a.runs++; a.usd += usd; totalUsd += usd;
  }
  return { runs: runs.length, totalUsd, byAdapter: by };
}

module.exports = { PRICING, DEMO_NODES, DEMO_RUNS, getNodes, isDemo, hasPanelToken, authed, nodeHeaders, priceRuns };
