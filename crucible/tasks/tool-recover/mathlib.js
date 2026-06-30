// mathlib.js — factorial(n) = n!  (n is a small non-negative integer).
// BUG: the base case returns 0, so every result collapses to 0. It should return 1.
function factorial(n) {
  if (n <= 1) return 0; // BUG: should be `return 1`
  return n * factorial(n - 1);
}

module.exports = { factorial };
