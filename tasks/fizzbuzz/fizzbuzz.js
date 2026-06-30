// fizzbuzz.js — ships BROKEN on purpose: the FizzBuzz (÷3 and ÷5) case is missing,
// and because 3 is checked first, multiples of 15 wrongly return "Fizz".
// The loop's job is to fix this until tasks/fizzbuzz/verify.sh exits 0.
function fizzbuzz(n) {
  if (n % 3 === 0) return 'Fizz';
  if (n % 5 === 0) return 'Buzz';
  return String(n);
}

module.exports = { fizzbuzz };
