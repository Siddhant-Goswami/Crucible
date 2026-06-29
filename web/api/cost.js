// GET /api/cost — price the merged ledger from measured tokens.
const { getNodes, isDemo, authed, nodeHeaders, priceRuns, DEMO_RUNS } = require('./_lib');

module.exports = async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'unauthorized' });
  let runs;
  if (isDemo()) { runs = DEMO_RUNS; }
  else {
    const all = await Promise.all(getNodes().map(async (n) => {
      try {
        const r = await fetch(`${n.url}/runs?limit=500`, { headers: nodeHeaders(n), signal: AbortSignal.timeout(4000) });
        return (await r.json()).runs || [];
      } catch { return []; }
    }));
    runs = all.flat();
  }
  res.status(200).json({ demo: isDemo(), ...priceRuns(runs) });
};
