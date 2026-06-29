# nemo-claw — Cost, Control Panel & Telegram

How to **price**, **manage**, and **remotely control** the loop-driven agent fleet,
plus how to wire it to **Telegram**. Everything here is dependency-free Node + bash
(no `npm install`), and runs offline by default.

---

## 1. Cost — measured, not guessed

The loop records **real token usage** for every run (the Ollama adapter captures
`prompt_eval_count` / `eval_count`) into `runs.jsonl`. `cost.js` prices that ledger
against `pricing.json` (verified Anthropic list prices + local = $0) and projects
to any volume, including node infra amortization.

```bash
node cost.js                                   # price what's in runs.jsonl
node cost.js --runs-per-day 500 --infra vps-hetzner-cx22
node cost.js --runs-per-day 500 --model claude-opus-4-8   # what-if on a frontier model
```

### The headline number (from the real `hello-sum` runs on this machine)

A `hello-sum` loop iteration measured **~213 input / 27 output tokens**. Priced per
backend, and projected at **500 runs/day**:

| Backend (per run) | $/run | Token cost @500/day | + Infra | **All-in / month** |
|---|---|---|---|---|
| **mock** (offline) | $0 | $0 | $0 (your Mac) | **$0** |
| **ollama** local qwen3:8b | **$0** | **$0** | $4.50 ($4 VPS) | **$4.50** |
| Hermes → local model | $0 | $0 | $4.50 | $4.50 |
| same workload on **Claude Opus 4.8** | $0.00116 | $17.40 | $4.50 | **$21.90** |
| same workload on **Haiku 4.5** | $0.00027 | $4.05 | $4.50 | $8.55 |

**Takeaways**
- The **lean/local path is ~$4.50/month flat** at 500 runs/day — the infra, not the model, is the only cost. This is the concrete "$" behind the "safe + lean" recommendation in [LEARNINGS.md](./LEARNINGS.md).
- A frontier cloud model is **still cheap for short loops** (cents/day) but scales with token volume; the local path doesn't.
- Real cost drivers to watch: **iteration count** (a loop that retries 3× costs 3× the tokens) and **context size**, not the per-token rate. Bounded loops (`MAX_ITERS`) are a cost control, not just a safety one.
- Pricing reference (USD per 1M tok): Opus 4.8 $5/$25 · Sonnet 4.6 $3/$15 · Haiku 4.5 $1/$5 · Fable 5 $10/$50. Batch API = 50%. Cache reads ≈ 0.1×. Edit `pricing.json` to update.

---

## 2. The control plane (manage many instances, local + remote)

```
                ┌─────────────────────────────┐
  Telegram ───▶ │  panel.js   (control plane) │ ──HTTP──▶ agent-node.js @ vps-1
  Dashboard ──▶ │  :8088  + dashboard + API   │ ──HTTP──▶ agent-node.js @ vps-2
                └──────────────┬──────────────┘ ──local─▶ loop.sh (this machine)
                               │ reads/merges
                          runs.jsonl  ◀── every node appends its results
```

- **`agent-node.js`** — the worker daemon. Run **one per machine** (laptop, VPS, Pi). Exposes `/health`, `/run`, `/runs`. Each run executes `loop.sh <task> <adapter>` locally and appends to that box's ledger.
- **`panel.js`** — the admin master control panel. Reads `nodes.json`, shows every instance's health, launches loops on any node, tails the merged ledger, shows live cost. Serves a dark-theme dashboard at `/` and a JSON API (`/api/nodes`, `/api/run`, `/api/runs`, `/api/cost`).
- **`nodes.json`** — the fleet registry. `kind: "local"` runs in-process; `kind: "http"` is a remote `agent-node`.

### Run it locally (one box, two "nodes" for demo)

```bash
# terminal 1 — a worker daemon acting as a remote node
AGENT_TOKEN=secret NODE_NAME=vps-1 PORT=7077 node agent-node.js
# terminal 2 — the control panel
node panel.js          # open http://127.0.0.1:8088
```
Point `nodes.json`'s `vps-1` token at `secret`, open the dashboard, pick a node +
task + adapter, hit **Run**. (Verified: a run dispatched to `vps-1` shows up in the
merged ledger tagged `node: "vps-1"`.)

### Add a real remote node (safe pattern)

`agent-node.js` can spawn processes, so **never expose it raw to the internet.**
Tunnel it over SSH and require a token:

```bash
# on the VPS:
git clone <this repo> && cd nemo-claw
AGENT_TOKEN=$(openssl rand -hex 16) NODE_NAME=vps-1 BIND=127.0.0.1 PORT=7077 node agent-node.js

# on your laptop — forward the port over SSH (no public exposure):
ssh -N -L 7077:127.0.0.1:7077 user@your-vps
```
Then set that node in `nodes.json`:
```json
{ "name": "vps-1", "kind": "http", "url": "http://127.0.0.1:7077", "token": "<the AGENT_TOKEN>" }
```
The panel now manages the remote box as if it were local. Repeat per machine.

> **Build vs buy:** Hermes and OpenClaw already ship multi-channel gateways with
> remote backends (Hermes: `docker`/`ssh`/`modal`/`daytona`; "serverless persistence"
> that hibernates when idle). This panel is the lean, harness-agnostic version that
> works across *all* the loop adapters. If you standardize on Hermes, you can let its
> gateway own the remote + Telegram layer instead — see [LEARNINGS.md](./LEARNINGS.md) §6.

---

## 3. Telegram

`telegram-bot.js` bridges Telegram → the panel API. It uses **long polling**
(`getUpdates`), so it needs **no public URL / webhook** — it runs fine on a laptop
or a $4 VPS behind NAT.

### Setup (~2 min, turn-key)
1. In Telegram, message **@BotFather** → `/newbot` → follow the prompts → copy the bot token.
2. Put your secrets in a gitignored file (never on the command line):
   ```bash
   cp .env.telegram.example .env.telegram
   # edit .env.telegram, paste your TELEGRAM_BOT_TOKEN
   ```
3. Find your chat id: open Telegram, send your new bot any message (e.g. `hi`), then:
   ```bash
   set -a; . ./.env.telegram; set +a; node telegram-whoami.js
   ```
   Copy the printed id into `TELEGRAM_ALLOWED_CHATS` in `.env.telegram`.
4. Launch (starts the panel too if it isn't running):
   ```bash
   ./telegram.sh
   ```
   Then message your bot `/nodes`.

> Your token lives only in `.env.telegram` (gitignored) — it never enters the
> repo, the chat, or your shell history. `TELEGRAM_ALLOWED_CHATS` is a hard
> allowlist; the bot ignores every other chat.

### Commands
| Command | Does |
|---|---|
| `/nodes` | health of every agent instance |
| `/run <task> <adapter> [node]` | launch a loop (e.g. `/run hello-sum ollama vps-1`) |
| `/runs` | last few runs across the fleet |
| `/cost` | spend so far (from measured tokens) |
| `/help` | command list |

### Safety (important)
- **`TELEGRAM_ALLOWED_CHATS` is a hard allowlist** — messages from any other chat are ignored. The bot can spawn processes; never run it open. (It warns loudly if the allowlist is empty.)
- The bot only ever calls the panel's API — same surface as the dashboard — so it can't do anything the panel can't.
- For production, run the bot and panel on the same host as the workers (or behind the SSH tunnel), not on a public box.

---

## Files

| File | Role |
|---|---|
| `cost.js` + `pricing.json` | price the ledger; project cost at volume |
| `agent-node.js` | per-machine worker daemon (deploy on each node) |
| `panel.js` + `nodes.json` | control plane + dashboard + fleet registry |
| `telegram-bot.js` | Telegram ↔ panel bridge (long polling, allowlisted) |
| `runs.jsonl` | append-only ledger every node writes to (gitignored) |
