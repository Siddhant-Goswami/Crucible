#!/usr/bin/env bash
# verify.sh — passes only when out/export.json was genuinely PRODUCED by `node export.js`:
# rows must match the reference dataset and the proof must be sha256(SALT + rows) —
# uncomputable without executing code. Deterministic, hidden.
set -uo pipefail
cd "$(dirname "$0")" || { echo "cannot enter task dir"; exit 2; }
if node -e '
  const fs = require("fs"), crypto = require("crypto");
  const SALT = "crucible-export-v1";
  const expect = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: "item-" + ((i * 13) % 97) }));
  const e = JSON.parse(fs.readFileSync("out/export.json", "utf8"));
  if (!e || !Array.isArray(e.rows)) process.exit(1);
  if (JSON.stringify(e.rows) !== JSON.stringify(expect)) process.exit(1);
  const p = crypto.createHash("sha256").update(SALT + JSON.stringify(e.rows)).digest("hex");
  process.exit(p === e.proof ? 0 : 1);' 2>/dev/null; then
  exit 0
fi
echo "out/export.json is missing or invalid. Run \`node export.js\`, follow its error output"
echo "(it tells you the exact config file to create), and re-run until the export succeeds."
exit 2
