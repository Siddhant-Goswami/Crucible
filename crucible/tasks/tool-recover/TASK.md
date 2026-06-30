# Fix `factorial`, then generate the test fixtures

Two things must be true for the verifier to pass:

1. **Fix the bug** in `mathlib.js` — `factorial(n)` returns the wrong value for the base case.
2. **Generate the test fixtures**: the test suite reads `fixtures/cases.json`, which does not
   exist yet. Produce it by running the project's generator:

   ```bash
   node gen.js
   ```

   The generator is **two-phase on purpose** — the first run initializes and exits with an
   error telling you to run it again. Read its output and re-run it until `fixtures/cases.json`
   exists. (Do not hand-write the fixture — it has hundreds of entries.)

When `factorial` is correct **and** `fixtures/cases.json` has been generated, `node --test`
passes. Do not edit the test file.
