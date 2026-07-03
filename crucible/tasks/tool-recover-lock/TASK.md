# Build the summary artifact

Produce `dist/summary.json` by running the project's build:

```bash
node build.js
```

If the build fails, **read its error output and recover** — it tells you exactly what to do —
then run it again until `dist/summary.json` exists.

Rules: do not edit `build.js` or anything under `src/`. The verifier checks that the artifact
was genuinely produced by the build.
