'use strict';
// stats.js — the report's statistics helpers, extracted so they're unit-testable (and so
// priceRun has one home). `rng` is injectable for deterministic tests (default Math.random).
const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

// 95% bootstrap CI of the mean → [lo, hi]; degenerate ([v,v]) for n < 2.
function bootCI(arr, B = 2000, rng = Math.random) {
  if (arr.length < 2) return [arr[0] ?? 0, arr[0] ?? 0];
  const ms = [];
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < arr.length; i++) s += arr[Math.floor(rng() * arr.length)]; ms.push(s / arr.length); }
  ms.sort((x, y) => x - y);
  return [ms[Math.floor(0.025 * B)], ms[Math.floor(0.975 * B)]];
}

// Paired bootstrap on per-key differences. Only keys present in BOTH maps are paired — callers
// key by "task|seed" so a multi-task battery doesn't conflate tasks under one seed.
function pairedBoot(aByKey, bByKey, B = 2000, rng = Math.random) {
  const keys = Object.keys(aByKey).filter(k => k in bByKey);
  const diffs = keys.map(k => aByKey[k] - bByKey[k]);
  if (diffs.length < 2) return { diff: mean(diffs), lo: NaN, hi: NaN, sig: false, n: diffs.length };
  const ms = [];
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < diffs.length; i++) s += diffs[Math.floor(rng() * diffs.length)]; ms.push(s / diffs.length); }
  ms.sort((x, y) => x - y);
  const lo = ms[Math.floor(0.025 * B)], hi = ms[Math.floor(0.975 * B)];
  return { diff: mean(diffs), lo, hi, sig: lo > 0 || hi < 0, n: diffs.length };
}

const median = a => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// pass^k (τ-bench): the probability that k independently-drawn attempts ALL pass — a reliability
// metric, not a peak one. Unbiased estimator over c passes in n attempts (draws without
// replacement): prod_{i=0}^{k-1} (c-i)/(n-i). pass^1 = success rate; pass^k falls fast if the
// harness is flaky. Returns null when n < k (can't estimate). A timeout counts as a non-pass.
function passK(c, n, k) {
  if (n < k || n <= 0) return null;
  let p = 1;
  for (let i = 0; i < k; i++) p *= (c - i) / (n - i);
  return Math.max(0, p);
}

// Marginal $ for a run given pricing.json. A LOCAL model is named "<name>:<size>" (has a colon,
// e.g. qwen3:8b) → keyed as ollama/<model> ($0 marginal). A CLOUD model has no colon (claude-opus-4-8,
// gpt-5.5, gpt-4o-mini) → keyed directly at its list price.
function priceRun(r, pricing) {
  if (!r.model || r.model === 'baseline') return 0;            // floor / local-unknown => $0 (don't alias a real key)
  const key = r.model.includes(':') ? 'ollama/' + r.model : r.model;
  const p = (pricing.models && pricing.models[key]) || { in: 0, out: 0 };
  return ((r.tokens_in || 0) * p.in + (r.tokens_out || 0) * p.out) / 1e6;
}

// Cloud-EQUIVALENT $ for a run: what it would cost to run this SAME model on a hosted endpoint —
// the apples-to-apples number for local-vs-cloud routing (local marginal $ is 0 but hides the
// hardware + latency you actually pay). claude-* price at their own rate; OSS local models price
// at their OpenRouter-hosted rate (openrouter/<model> in pricing.json). Returns null if unpriced.
function priceRunCloud(r, pricing) {
  if (!r.model || r.model === 'baseline') return null;
  const key = r.model.includes(':') ? 'openrouter/' + r.model : r.model;   // local -> hosted equiv; cloud -> itself
  const p = pricing.models && pricing.models[key];
  if (!p) return null;
  return ((r.tokens_in || 0) * p.in + (r.tokens_out || 0) * p.out) / 1e6;
}

module.exports = { mean, median, passK, bootCI, pairedBoot, priceRun, priceRunCloud };
