#!/usr/bin/env bash
# ollama.sh — a REAL, TASK-AGNOSTIC agent step backed by a LOCAL model.
#
# Offline, zero API cost: the model runs on your machine via Ollama's HTTP API,
# so there is no off-box network call, no API key, and no per-token charge. The
# only side effects are writes to SOURCE files inside the sandboxed workdir.
#
# Unlike the original single-file version, this adapter works for ANY task in
# tasks/: it shows the model every project file, asks it to return the complete
# new contents of whichever files it wants to change (multi-file capable), and
# applies those edits with path sanitization. The verifier still owns done/keep-going.
#
# Design notes (see LEARNINGS.md "Gotchas"):
#   - We call the HTTP API (/api/generate), NOT `ollama run`, because the CLI emits
#     TTY spinner/cursor escape codes even when piped — the API returns clean JSON.
#   - think:false disables qwen3/deepseek-r1 chain-of-thought — faster, no reasoning
#     prose leaking into files.
#   - The model returns each changed file wrapped in ===FILE: <path>=== / ===END===
#     sentinels; a small node parser extracts + applies them. This is far more
#     robust for weak local models than unified diffs (no exact-line-match needed).
#   - Integrity guard: the parser REFUSES to write test files, verify.sh or TASK.md,
#     and rejects path traversal (.. / absolute paths) — a model can't "pass" by
#     rewriting the test or escaping the sandbox.
#
# Contract: ollama.sh <workdir> <iter> <feedback-file>
# Env: OLLAMA_MODEL (default qwen3:8b), OLLAMA_HOST (default http://localhost:11434)
#      OLLAMA_TEMPERATURE (default 0 — deterministic, for fair benchmarking)
set -uo pipefail
WORK="$1"; ITER="$2"; FEEDBACK="$3"
MODEL="${OLLAMA_MODEL:-qwen3:8b}"
HOST="${OLLAMA_HOST:-http://localhost:11434}"
TEMP="${OLLAMA_TEMPERATURE:-0}"
SEED="${OLLAMA_SEED:-}"                 # Crucible sets this per-run so seeds give variance (P9)
# Cap generation per call. Honor the task's MAX_TOKENS budget when it is smaller than the
# anti-runaway ceiling (4096); otherwise use 4096 — a confused model on an impossible task would
# otherwise ramble for tens of thousands of tokens (minutes/iter). loop.sh separately enforces
# the CUMULATIVE token budget across iterations.
_NP_DEFAULT=4096
if [ "${MAX_TOKENS:-0}" -gt 0 ] && [ "${MAX_TOKENS:-0}" -lt "$_NP_DEFAULT" ]; then _NP_DEFAULT="$MAX_TOKENS"; fi
NUM_PREDICT="${OLLAMA_NUM_PREDICT:-$_NP_DEFAULT}"

TASK="$(cat "$WORK/TASK.md" 2>/dev/null)"
FB=""; [ -s "$FEEDBACK" ] && FB="$(cat "$FEEDBACK")"

# --- assemble the project context the model sees ------------------------------
# Every regular file except the harness plumbing and VCS/dependency noise. Test
# files ARE shown (so the model knows the expected behavior) but are never written.
CTX=""
while IFS= read -r f; do
  CTX="$CTX
--- BEGIN FILE: $f ---
$(cat "$WORK/$f")
--- END FILE: $f ---
"
done < <(cd "$WORK" && find . -type f \
  -not -path './node_modules/*' -not -path './.git/*' \
  -not -name '.*' -not -name 'verify.sh' -not -name 'TASK.md' -not -name 'result.json' \
  | sed 's|^\./||' | sort)

PROMPT="You are an automated coding agent. Edit/create the SOURCE or artifact files
so the project's rules-based verifier (./verify.sh) passes.

OUTPUT FORMAT — for EACH file you want to change, emit a block EXACTLY like:
===FILE: relative/path.js===
<the complete new contents of that file>
===END===
Rules: output ONLY these blocks, nothing else. No markdown fences, no commentary.
You may emit multiple file blocks. NEVER edit test files (*.test.js) or verify.sh.

TASK:
$TASK

PROJECT FILES:
$CTX"
if [ -n "$FB" ]; then
  PROMPT="$PROMPT

The previous attempt FAILED the verifier. It said:
$FB
Return the corrected file(s)."
fi

RESP="$(curl -s "$HOST/api/generate" -d "$(jq -n \
  --arg m "$MODEL" --arg p "$PROMPT" --argjson t "$TEMP" --argjson s "${SEED:-null}" --argjson np "$NUM_PREDICT" \
  '{model:$m, prompt:$p, stream:false, think:false,
    options:({temperature:$t, num_predict:$np} + (if $s==null then {} else {seed:$s} end))}')")"

TEXT="$(printf '%s' "$RESP" | jq -r '.response // empty')"

# Record real token usage so cost.js can price the run. Ollama returns
# prompt_eval_count (input) and eval_count (output). Accumulate across iters.
IN="$(printf '%s' "$RESP" | jq -r '.prompt_eval_count // 0')"
OUT="$(printf '%s' "$RESP" | jq -r '.eval_count // 0')"
PREV_IN=0; PREV_OUT=0
if [ -f "$WORK/.tokens" ]; then read -r PREV_IN PREV_OUT < "$WORK/.tokens"; fi
echo "$(( PREV_IN + IN )) $(( PREV_OUT + OUT ))" > "$WORK/.tokens"

# Mark the run as seed-controlled so finalize can record seeded=true (P9). Only adapters
# that actually pin the RNG seed drop this; others' multi-seed cells are independent samples.
[ -n "$SEED" ] && : > "$WORK/.seeded"

# --- apply the model's file blocks (robust parse + sandbox guard) -------------
printf '%s' "$TEXT" | node -e '
  const fs = require("fs"), path = require("path");
  const work = path.resolve(process.argv[1]);
  let text = "";
  process.stdin.on("data", d => text += d).on("end", () => {
    const re = /===FILE:\s*(.+?)\s*===\r?\n([\s\S]*?)\r?\n?===END===/g;
    // never let the model overwrite the test, the gate, or the goal
    const forbid = /(^|\/)(verify\.sh|TASK\.md)$|\.test\.js$|[-_]test\.js$|(^|\/)test\.js$/;
    let m, wrote = 0;
    while ((m = re.exec(text))) {
      let rel = m[1].trim().replace(/^\.\//, "");
      let body = m[2]
        .replace(/^[ \t]*```[a-zA-Z0-9]*[ \t]*\r?\n/, "")  // strip a leading ``` fence
        .replace(/\r?\n[ \t]*```[ \t]*$/, "");             // and a trailing one
      if (rel.startsWith("/") || rel.split("/").includes("..")) {
        console.error("  (ollama: skip unsafe path " + rel + ")"); continue;
      }
      // refuse hidden/harness metadata (.tokens, .feedback, .git, …) — loop.sh
      // trusts .tokens for cost/token reporting, so the model must not write it.
      if (rel.split("/").some(seg => seg.startsWith("."))) {
        console.error("  (ollama: refusing to write hidden/harness file " + rel + ")"); continue;
      }
      if (forbid.test(rel)) {
        console.error("  (ollama: refusing to write protected file " + rel + ")"); continue;
      }
      const dest = path.resolve(work, rel);
      if (dest !== work && !dest.startsWith(work + path.sep)) {
        console.error("  (ollama: path escapes sandbox " + rel + ")"); continue;
      }
      if (!body.endsWith("\n")) body += "\n";
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, body);
      console.error("  (ollama: wrote " + rel + ")");
      wrote++;
    }
    if (!wrote) console.error("  (ollama: no usable file blocks in response; leaving files unchanged)");
    process.exit(0);
  });
' "$WORK"
