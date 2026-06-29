# Task: convert integers to Roman numerals

`roman.js` exports `toRoman(n)` for `1 <= n <= 3999`, but ships **broken on
purpose**: it only handles *additive* numerals, so it returns `"IIII"` for 4 and
`"VIIII"` for 9 instead of the *subtractive* forms `"IV"` and `"IX"`.

Fix `toRoman` to produce standard Roman numerals, including every subtractive
case: `IV (4)`, `IX (9)`, `XL (40)`, `XC (90)`, `CD (400)`, `CM (900)`.

Examples: `toRoman(1994) === "MCMXCIV"`, `toRoman(2023) === "MMXXIII"`.

Edit `roman.js` so `node --test` passes. Do not edit the test file.
