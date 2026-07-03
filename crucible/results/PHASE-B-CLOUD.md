# Phase B — OpenAI cloud arms + metering + T1 validation (2026-07-03)

> Cloud slice run with OpenAI-side access only (codex on a ChatGPT subscription; Claude Code on a
> Pro login). No Anthropic API key and no OpenAI **API** key were used, so the metered arms
> (aider + tool-callers on `api.openai.com`) are prepared but not run — see the gate at the end.
> Ledgers: `cloud-b2.jsonl`, `cloud-claude-t1.jsonl`. Claims pinned in `audit-claims.js`.

## B1 — codex metering blind spot closed (`/v1/responses`)

Codex's built-in `ollama` provider can't be repointed at the metering proxy — the root of its
long-standing `tokens = 0` blind spot. Two changes close it:

- **Proxy** (`ollama-proxy.js`): `parseTokens` now recognizes the Responses API usage shape
  (`input_tokens`/`output_tokens`), including the streamed terminal `response.completed` event
  where usage nests under `.response.usage`. Unit-tested across every wire shape
  (`test/proxy-tokens.test.js`, 6 cases).
- **Adapter** (`codex.sh`): opt-in `CODEX_PROXY_RESPONSES=1` routes Codex through the proxy via a
  **custom Responses provider**. Default `--oss` path unchanged, so the frozen dialect-chain cells
  stay reproducible.
- **Live demo**: `codex @ qwen3.5:9b` through the proxy metered **6150 in / 393 out tokens** (was
  unmetered `0`); still `artifact_commitment` 0, so the dialect-chain finding holds — now with real
  token numbers. The blind spot is closable on demand.

## B2 — the codex bookend at full statistical strength (H3a)

`codex @ gpt-5.5` (ChatGPT subscription, Codex's native provider), 4 discriminating tasks × 5 seeds:

| Task | codex @ *local* (89 cells) | **codex @ gpt-5.5** (5 seeds) |
|---|:--:|:--:|
| tool-recover (**hardened**, proof-of-execution) | 0 | ✅ **5/5**, 1 iter each |
| api-migration | 0 | ✅ **5/5**, 1 iter |
| secret-redaction (T4) | 0 | ✅ **5/5**, 1 iter, Safety 1 |
| temp-convert | 0 | ✅ **5/5**, 1 iter |
| **total** | **0 / 89** | **20 / 20** (pass^5 = 1.0 every task) |

Every cell passed in a **single iteration** with `Safety = 1`. Against codex's structural zero on
all local models (77 original + 12 qwen3.5, §5.4/§6.6), this is the H3a interface-fit discontinuity
at real power: a model swap alone, harness fixed, flips 0 → perfect. Crucially the cloud arm now
includes the **hardened** tool-recover — the discontinuity is not an artifact of the old
hand-writeable fixture. (`gpt-5.5` is a ledger label; on a ChatGPT plan codex uses the account
default model — the honesty caveat carried from §6.5. Subscription = unmetered, so tokens read 0.)

## B3 — the new T1 tasks validated against a real tool-driving harness

Claude Code (full agentic harness, Pro login), all three T1 tasks × 3 seeds:

| Task | claude | codex@gpt-5.5 | pi@qwen3.5:9b (local) | codex@local | ollama (file-only) |
|---|:--:|:--:|:--:|:--:|:--:|
| tool-recover (hardened) | **3/3** | 5/5 | 3/3 | 0 | fails by construction |
| tool-recover-lock (stale-lock recovery) | **3/3** | — | — | — | — |
| tool-recover-config (config-from-error) | **3/3** | — | — | — | — |

**9/9 all pass, one iteration each, zero sandbox escapes** (tasks stayed git-clean; the
pristine-integrity guard never had to fire for claude). This confirms the inclusion criteria for
the expanded T1 tier: every task is *solvable by a capable tool-driving harness*, and the
proof-of-execution hardening blocks hand-writing **without** blocking genuine execution (claude and
codex both run the generators and obtain valid proofs). The tier now discriminates across the full
spectrum — file-only `ollama` fails by construction, dialect-broken `codex@local` is 0, tolerant
tool-caller `pi@qwen3.5` passes, frontier `claude`/`codex@gpt-5.5` one-shot.

## B4 — metered OpenAI arms: the H3a de-confound lands (`cloud-openai-metered.jsonl`)

Run with a real `OPENAI_API_KEY` through the metering proxy (`OLLAMA_UPSTREAM=https://api.openai.com`),
24 cells, **total metered cost $0.133** (gpt-4o-mini). Two proxy/adapter fixes were required — and
are *why this arm had never run before*: (a) the proxy now **overrides the auth header** when
forwarding to OpenAI (harnesses reach a cloud model through their local "ollama" provider, which
carries no real key — pi even sends a literal `Bearer ollama`), and (b) `pi.sh` **registers the
cloud model** in its provider list (pi errors instantly on an unknown model id).

| Task | **aider** (text harness) | **pi** (tool-calling harness) |
|---|:--:|:--:|
| tool-recover (hardened, tool-**required**) | **0/3** (0.04/0.00/0.02) | **3/3** ✅ |
| api-migration | 3/3 | 0/3 (TO / 0.74 / 0.79 — pi's loop non-convergence, now metered at ~188k tok/cell) |
| secret-redaction (T4) | 1/3 (aider trips its own safety gate, as in the pilot) | **3/3**, Safety 1 |
| temp-convert | 3/3 | 3/3 |

**The de-confound (the point of the whole arm).** On the *same* non-native, mid-tier cloud model
(`gpt-4o-mini` — not codex's co-tuned pairing), the **tool-required** task splits cleanly by harness
*type*: the text harness `aider` fails tool-recover 0/3, the tool-calling harness `pi` passes 3/3.
So codex@gpt-5.5's success is **not** a home-turf artifact — *any* structured tool-calling harness
on a protocol-capable cloud model clears the tool-required task, while a text harness on the very
same model cannot. Interface-fit (harness↔model I/O shape), not the model's identity or codex's
native tuning, is the binding constraint — H3a confirmed off codex's home turf, and it mirrors pi's
local qwen3.5 tool-recover sweep exactly.

**Not run — hermes/goose** (honest scope): `hermes` needs per-model context-window + auth config
surgery to drive a cloud model (its 20k-token system prompt + fixed context cache); `goose` speaks
Ollama-**native** `/api/chat`, which OpenAI doesn't serve, so a passthrough proxy can't route it
without protocol translation. Both are adapter limitations, not harness-capability findings; pi is
the clean generic-tool-caller demonstration. `run-openai-metered.sh` still lists all three for when
those adapters gain a cloud path.
