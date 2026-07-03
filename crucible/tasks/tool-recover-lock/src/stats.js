'use strict';
// stats.js — aggregation used by build.js. Correct as shipped; do not edit.
function summarize(rows) {
  return { count: rows.length, total: rows.reduce((s, r) => s + r.v, 0) };
}
module.exports = { summarize };
