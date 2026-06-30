// fahrenheit.js — ships BROKEN on purpose: missing the - 32 offset.
// Correct: C = (f - 32) * 5/9.
function toC(f) {
  return f * 5 / 9;
}

module.exports = { toC };
