// sum.js — ships BROKEN on purpose (a - b instead of a + b).
// The loop's job is to fix this until tasks/hello-sum/verify.sh exits 0.
function sum(a, b) {
  return a - b;
}

module.exports = { sum };
