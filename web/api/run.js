// POST /api/run — proxy a loop launch to a chosen (public) agent-node.
// Disabled in demo mode and refuses to run live unless PANEL_TOKEN is set
// (fail-closed: a public panel must never be able to trigger execution unauthed).
const { getNodes, isDemo, hasPanelToken, authed, nodeHeaders } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (isDemo()) return res.status(403).json({ error: 'demo mode — set NODES (and PANEL_TOKEN) to enable runs' });
  if (!hasPanelToken()) return res.status(403).json({ error: 'set PANEL_TOKEN before enabling runs (fail-closed)' });
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });

  const b = req.body || {};
  const node = getNodes().find((n) => n.name === b.node);
  if (!node) return res.status(400).json({ error: `unknown node ${b.node}` });
  try {
    const r = await fetch(`${node.url}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...nodeHeaders(node) },
      body: JSON.stringify({ task: b.task, adapter: b.adapter, maxIters: b.maxIters }),
      signal: AbortSignal.timeout(8000)
    });
    return res.status(202).json(await r.json());
  } catch (e) {
    return res.status(502).json({ error: `node ${node.name} unreachable: ${e.message}` });
  }
};
