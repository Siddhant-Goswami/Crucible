// GET /api/nodes — health of every registered agent instance.
const { getNodes, isDemo, authed, nodeHeaders, DEMO_NODES } = require('./_lib');

module.exports = async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
  if (isDemo()) return res.status(200).json({ demo: true, nodes: DEMO_NODES });
  const nodes = await Promise.all(getNodes().map(async (n) => {
    try {
      const r = await fetch(`${n.url}/health`, { headers: nodeHeaders(n), signal: AbortSignal.timeout(4000) });
      const h = await r.json();
      return { name: n.name, kind: 'http', url: n.url, ok: !!h.ok, adapters: h.adapters || [], running: h.running, load: Array.isArray(h.load) ? h.load[0] : h.load };
    } catch (e) {
      return { name: n.name, kind: 'http', url: n.url, ok: false, error: String(e.message || e) };
    }
  }));
  res.status(200).json({ nodes });
};
