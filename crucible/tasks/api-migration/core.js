// core.js — RENAME the export `tally` to `total` (identical behavior). The old name must be gone.
function tally(items) { return items.reduce((s, x) => s + x, 0); }
module.exports = { tally };
