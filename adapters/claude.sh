#!/usr/bin/env bash
# claude.sh — drive Claude Code headless (`claude -p`) as a TASK-AGNOSTIC agent step.
#
# REAL and capable, but spends tokens on your Claude subscription, so the
# comparison harness only runs this when RUN_CLAUDE=1. This is the closest analog
# to how the 100x-loops themselves run (GRADER=claude), except here the shell owns
# the outer loop instead of a Stop hook.
#
# Like the generalized ollama adapter, this works for ANY task in tasks/: it points
# Claude at TASK.md + the prior verifier feedback and lets Claude use its own
# Read/Edit/Write/Bash tools to change whatever SOURCE or artifact files the task
# needs (single- or multi-file). The integrity rule is stated in the prompt (never
# touch tests, verify.sh or TASK.md); the rules-based verifier owns done/keep-going.
#
# Token usage is captured from --output-format json and accumulated into .tokens
# (input incl. cache, + output), so cost.js can price the run honestly
# (claude -> claude-opus-4-8 in pricing.json; summing cache tokens at full rate is
# a deliberate UPPER bound — no cache discount applied).
#
# Contract: claude.sh <workdir> <iter> <feedback-file>
set -uo pipefail
WORK="$1"; FEEDBACK="$3"
command -v claude >/dev/null 2>&1 || { echo "claude not installed" >&2; exit 1; }

TASK="$(cat "$WORK/TASK.md" 2>/dev/null)"
FB=""
[ -s "$FEEDBACK" ] && FB="The previous attempt FAILED the verifier. Feedback:
$(cat "$FEEDBACK")"

cd "$WORK" || { echo "claude: cannot enter workdir $WORK" >&2; exit 1; }
RESP="$(claude -p "You are an automated coding agent working in the current directory.
Make this project's rules-based verifier (./verify.sh) pass.

TASK:
$TASK

$FB

Rules: edit/create only the SOURCE or artifact files the task asks for. NEVER edit
test files (*.test.js), verify.sh, or TASK.md. You may touch multiple files." \
  --allowedTools "Read,Edit,Write,Bash" \
  --output-format json 2>/dev/null || true)"

# accumulate measured tokens so cost.js can price this run
printf '%s' "$RESP" | node -e '
  let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
    let inT=0,outT=0;
    try {
      const j=JSON.parse(s); const u=j.usage||{};
      inT=(u.input_tokens||0)+(u.cache_creation_input_tokens||0)+(u.cache_read_input_tokens||0);
      outT=(u.output_tokens||0);
    } catch(e){}
    const fs=require("fs"); const f=process.argv[1]+"/.tokens";
    let pin=0,pout=0;
    try { [pin,pout]=fs.readFileSync(f,"utf8").trim().split(/\s+/).map(Number); } catch(e){}
    fs.writeFileSync(f, (pin+inT)+" "+(pout+outT)+"\n");
  });
' "$WORK"
