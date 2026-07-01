# Crucible v2 — progress & resume handoff

**Status as of 2026-07-01.** Branch **`crucible-v2`** (pushed to `origin/crucible-v2`, PR-ready).
This is the "complete & broaden" phase (workstreams **A + B**) on top of merged v1. Use this doc to
resume after a context reset.

## What's DONE (committed + pushed on `crucible-v2`)

- **B — broaden the harness panel:**
  - `adapters/codex.sh` — OpenAI Codex CLI headless (`codex exec --oss --local-provider ollama
    --sandbox workspace-write --skip-git-repo-check -C <workdir>`). **Unmetered** (Codex's `ollama`
    is a reserved built-in provider whose base_url can't be overridden → bypasses the proxy → tokens
    read 0, documented). Finding: weak local models can't drive Codex's structured tool protocol
    ("unsupported tool call") → it fails rather than crashes. ~51s/iter.
  - `adapters/aider.sh` — aider headless (`--message`, `--no-git`, `--yes-always`,
    `--model ollama_chat/<model>`). **Metered** via `OLLAMA_API_BASE` → the Crucible proxy. Passes
    hello-sum on qwen3:8b (tokens 847/393). Installed via `uv tool install aider-chat`.
  - `harness-profiles.json`: codex + aider entries. openhands **deferred** (Docker-heavy).
- **A — durable runner + wider panel:**
  - `crucible/run-detached.sh` — **the durability fix.** Runs a battery as a macOS **launchd**
    LaunchAgent (`com.crucible.battery`) wrapped in `caffeinate -i -s`, so it's reparented to launchd
    and **survives the launching session/terminal + Mac sleep** (v1's runs kept getting SIGTERM'd as
    children of the agent session). Subcommands: `start` / `status` / `stop`. Resumable.
  - `crucible/bench.sh`: default panel widened to **7 lean harnesses**
    (`mock,ollama,pi,hermes,goose,codex,aider`) × **3 local models**
    (`deepseek-r1:1.5b,qwen3:8b,deepseek-r1:8b`).
  - `pricing.json`: explicit `$0` row for `ollama/deepseek-r1:1.5b`.

Commits: `2db1725` (B adapters), `e4f32b1` (A infra).

## What's RUNNING

The **full grid** is running durably via `run-detached.sh` (launched with `RUN_CLAUDE=1 RESUME=1`),
resuming the on-disk ledger `crucible/results/battery.jsonl` (gitignored). Full local grid = **495
cells** (9 tasks × [mock + 6 lean × 3 models × 3 seeds]) + the Claude slice.
Progress at handoff: **~386/495 local cells done, ~109 remaining** (the slow tail: codex/aider/goose/
hermes on `secret-redaction`/`tool-recover`/`api-migration`), 142 passes, 41 timeouts. **ETA ~3 h.**

Check it: `./crucible/run-detached.sh status`  ·  `tail -f crucible/results/bench.log`
Stop it (resumable): `./crucible/run-detached.sh stop`

## What's LEFT — finish task 17 (do this when the run completes)

1. Confirm done: `./crucible/run-detached.sh status` shows not-running, and
   `wc -l crucible/results/battery.jsonl` has stabilized (~495+ rows). If cells are still missing,
   `RESUME=1 ./crucible/run-detached.sh start` to backfill.
2. Regenerate the scorecard: `node crucible/report.js crucible/results/battery.jsonl`
   (bench.sh also writes it at the end). Confirm codex/aider rows across all 3 models, the `TO`
   column, transfer, significance, failure modes.
3. **Refresh the writeup + docs** with the complete numbers + expanded panel:
   - `docs/crucible-results.md` §5 (rewrite the headline from the new SCORECARD; note codex is
     unmetered + fails-on-local-models finding; aider metered).
   - `crucible/README.md` harness list + `docs/crucible-explainer.md` panel (add codex, aider,
     3 models).
   - Commit `SCORECARD.md` + `ENV.md` + the doc edits; push `crucible-v2`; the PR is ready to merge.
4. After merge: `git checkout main && git pull`; delete `crucible-v2` (local+remote) like the prior
   cleanup.

## Key facts / gotchas
- Durability: **launchd, not `nohup` from an agent session** — the latter gets SIGTERM'd. `caffeinate`
  prevents sleep.
- Metering: `ollama`/`goose` (env `OLLAMA_HOST`), `hermes`/`pi` (config redirect), `aider`
  (`OLLAMA_API_BASE`), `claude` (own usage). **`codex`/`openclaw` unmetered** → cost `—`.
- Timeouts are first-class (recorded as stubs, excluded from scores, shown in the `TO` column).
- Ledger + logs are gitignored (`crucible/results/*.jsonl`, `*.log`); `SCORECARD.md`/`ENV.md` are tracked.
- Foundations: `docs/harness-first-principles.md`, `crucible/SPEC.md`, `crucible/RATIONALE.md`.
