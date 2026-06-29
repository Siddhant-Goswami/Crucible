// GET /api/runs — merged run ledger across all nodes (the ledger lives on the
// workers now; Vercel has no persistent disk, so we fan out and merge).
const { getNodes, isDemo, authed, nodeHeaders, DEMO_RUNS } = require('./_lib');

module.exports = async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
  const limit = Number(req.query?.limit || 40);
  if (isDemo()) return res.status(200).json({ demo: true, runs: DEMO_RUNS.slice(0, limit) });
  const all = await Promise.all(getNodes().map(async (n) => {
    try {
      const r = await fetch(`${n.url}/runs?limit=${limit}`, { headers: nodeHeaders(n), signal: AbortSignal.timeout(4000) });
      const j = await r.json();
      return j.runs || [];
    } catch { return []; }
  }));
  const merged = all.flat().sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, limit);
  res.status(200).json({ runs: merged });
};
