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

## What's DONE — the battery COMPLETED (2026-07-01)

The **full grid ran to completion** durably via `run-detached.sh` (launchd + caffeinate). Final
ledger `crucible/results/battery.jsonl` (gitignored): **507 runs, 55 timeouts, no coverage gaps**
(8 harnesses × 3 local models × 9 tasks × 3 seeds + the Claude slice). The idle launchd job has been
stopped + unloaded (`run-detached.sh stop`). Scorecard + ENV regenerated; writeup rewritten from the
new numbers; committed + pushed as **`498f3f8`** on `crucible-v2`.

**Headline results (see `docs/crucible-results.md` §5 / `crucible/results/SCORECARD.md`):**
- **aider** is the standout lean harness — the only non-Claude harness with reach across all 3
  models (0.58 / 0.73 / 0.88 on r1:1.5b / qwen3:8b / r1:8b), significantly beats the `ollama` control
  on both deepseek-r1 models. Metered, ~$0.
- **codex** = structural zero (**0/77**): local models can't drive its structured tool protocol
  ("unsupported tool call") → no artifact; fails clean. Unmetered.
- **Output shape reorders the field:** pi/hermes/goose/codex collapse to 0 on both reasoning models
  (deepseek-r1 `<think>` traces break brittle parsers) but reach ~1.0 on clean-output qwen3:8b; only
  aider + ollama survive the reasoning models.
- **Safety gate** now catches more than `mock` — aider trips it on a couple cells (Safety 0.92/0.98).

## What's LEFT

1. **Open + merge the PR** for `crucible-v2` (branch is pushed and PR-ready).
2. After merge: `git checkout main && git pull`; delete `crucible-v2` (local+remote) like the prior
   cleanup. Also fine to `git clean` the ignored `.aider*` / `crucible/results/*.jsonl` locals.

## Key facts / gotchas
- Durability: **launchd, not `nohup` from an agent session** — the latter gets SIGTERM'd. `caffeinate`
  prevents sleep.
- Metering: `ollama`/`goose` (env `OLLAMA_HOST`), `hermes`/`pi` (config redirect), `aider`
  (`OLLAMA_API_BASE`), `claude` (own usage). **`codex`/`openclaw` unmetered** → cost `—`.
- Timeouts are first-class (recorded as stubs, excluded from scores, shown in the `TO` column).
- Ledger + logs are gitignored (`crucible/results/*.jsonl`, `*.log`); `SCORECARD.md`/`ENV.md` are tracked.
- Foundations: `docs/harness-first-principles.md`, `crucible/SPEC.md`, `crucible/RATIONALE.md`.
