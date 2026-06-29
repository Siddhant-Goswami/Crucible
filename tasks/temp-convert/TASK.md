# Task: fix the temperature converters (two files)

This task spans **two source files**, both broken on purpose:

- `celsius.js` exports `toF(c)` — Celsius → Fahrenheit. Correct formula:
  `F = c * 9/5 + 32`. It currently forgets the `+ 32` offset.
- `fahrenheit.js` exports `toC(f)` — Fahrenheit → Celsius. Correct formula:
  `C = (f - 32) * 5/9`. It currently forgets the `- 32`.

Fix **both** files so `node --test` passes (the suite checks each direction and a
round-trip, including the `-40` fixed point where both scales meet). Do not edit
the test file.
