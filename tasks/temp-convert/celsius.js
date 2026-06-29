// celsius.js — ships BROKEN on purpose: missing the + 32 offset.
// Correct: F = c * 9/5 + 32.
function toF(c) {
  return c * 9 / 5;
}

module.exports = { toF };
