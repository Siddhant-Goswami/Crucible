// roman.js — ships BROKEN on purpose: only additive numerals, no subtractive
// pairs (so 4 -> "IIII", 9 -> "VIIII", 40 -> "XXXX", ...). The loop's job is to
// fix this until tasks/roman-numerals/verify.sh exits 0.
function toRoman(n) {
  const map = [
    [1000, 'M'], [500, 'D'], [100, 'C'], [50, 'L'], [10, 'X'], [5, 'V'], [1, 'I'],
  ];
  let out = '';
  for (const [value, sym] of map) {
    while (n >= value) {
      out += sym;
      n -= value;
    }
  }
  return out;
}

module.exports = { toRoman };
