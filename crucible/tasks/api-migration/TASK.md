# Rename the `tally` API to `total` — consistently, across all files

`core.js` exports a function named `tally`. Rename it to **`total`** (identical behavior) and
update **every caller** to use the new name. The old name `tally` must be **gone** everywhere.

Files involved (all must end up consistent):

- `core.js` — exports `tally`; rename the export to `total`.
- `a.js`, `b.js`, `c.js`, `d.js` — each calls `core.tally(...)`; update each to `core.total(...)`.

`node --test` passes only when **all five** files are migrated consistently — a single missed
caller (still referencing the removed `tally`) fails the suite. Do not edit the test file.
