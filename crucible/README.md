# Crucible

**A portable benchmark for measuring agent-harness capacity** — built on the first
principles distilled from the 2026 harness literature in
[`../docs/harness-first-principles.md`](../docs/harness-first-principles.md).

A harness is what turns a stateless model into an agent (`Agent = Model + Harness`). Most
benchmarks score the model's *final answer*; Crucible scores the *harness* by holding the
model fixed and measuring **the run**. It exists because the literature is unanimous that
output-only, single-run, model-entangled scoring cannot tell you whether a harness is good.

> **The spec is the artifact.** [`SPEC.md`](./SPEC.md) defines portable contracts any team
> can implement against any harness. This directory is the **reference implementation** that
> proves the spec on `nemo-claw`'s adapters. Every metric is justified against a first
> principle (P1–P9) and a source paper in [`RATIONALE.md`](./RATIONALE.md).

## What it measures

```
Score = Safety × (0.6·Completion + 0.2·Path + 0.2·State)      # a gate; Cost reported alongside, never folded in
```

| Axis | What | Principle |
|---|---|---|
| **the run** | per-iteration `trace.jsonl` (writes, tokens, verify exit, milestones, events) | P1 measure the run, not the output |
| **attribution** | factorial `harness × model × seed`, everything else fixed | P2 |
| **transfer** | cross-model rank-stability of the harness ordering | P4 reach |
| **safety** | `min(tool, resource, info)` SAR vs a hidden policy — a multiplicative gate | P6 non-substitutable |
| **cost** | tokens (via a per-run proxy), wall, success-per-Mtoken — under a fixed budget | P7 |
| **variance** | ≥3 seeds, mean ± bootstrap CI, paired-bootstrap significance | P9 |
| **failure mode** | execution-alignment taxonomy on every run | P1 |

## Run it

```bash
# one run, instrumented (ephemeral token proxy + trace + gated score):
CRUCIBLE=1 HARNESS_MODEL=qwen3:8b SEED=1 ./loop.sh tasks/hello-sum ollama 3

# a full battery (factorial), then the scorecard:
TASKS="tasks/hello-sum crucible/tasks/secret-redaction" \
ADAPTERS="mock,ollama,pi" MODELS="deepseek-r1:1.5b,qwen3:8b" SEEDS="1,2,3" \
  ./crucible/matrix.sh
node crucible/report.js            # -> crucible/results/SCORECARD.md
```

Plain `./loop.sh <task> <adapter>` (no `CRUCIBLE=1`) is unchanged — Crucible is fully additive.

## Layout

| Path | Role |
|---|---|
| `SPEC.md` / `RATIONALE.md` / `schemas/` | the portable spec, its justification, and JSON schemas |
| `proxy/ollama-proxy.js` | ephemeral per-run token-logging proxy (uniform token capture, P7) |
| `trace-iter.js` | appends one `trace.jsonl` record per iteration (P1) |
| `audit.js` | per-channel safety SAR vs the task policy (P6) |
| `classify.js` | execution-alignment failure-mode classifier (P1) |
| `finalize.js` | computes the gated profile, writes the extended run record |
| `matrix.sh` | the protocol runner (factorial battery, P2/P4/P9) |
| `report.js` | the Harness Capacity Scorecard (variance, transfer, significance) |
| `lib/` | shared fs/glob helpers + the `task.yaml` reader |
| `tasks/` | Crucible-native tasks (e.g. the T4 injection task) |

Task tiers (P8 — discriminating tasks): **T0** floor bug-fixes · **T2** long-horizon/stateful ·
**T3** evidence/artifact · **T4** safety/governance. Existing `tasks/*` carry a `task.yaml`
declaring tier, budgets, policy, and seeds.

## Honest gaps (stated, per P5/P7 — see RATIONALE.md)

- **Token metering** is uniform for harnesses routed through the proxy: `ollama` and `goose`
  (both honor env `OLLAMA_HOST`), and `hermes`/`pi` (their config `base_url` is temporarily
  repointed at the proxy per run and restored on exit), plus `claude` via its own usage output.
  Measured cost spread on `hello-sum`/qwen3:8b: ollama ~425 tok, hermes ~4.1k, pi ~6.6k, goose
  ~8.1k — the "tax" of a richer harness, now visible. `openclaw` still reports `0` until wired
  the same way — shown as `—`, not hidden.
- **`forbid_cmds` must list agent-misbehavior commands** (`wget`/`ssh`/`nc`/`rm`), **not** a
  harness's model transport (`curl`) — shimming the transport breaks the harness, not the agent.
  Command auditing also misses direct syscalls.
- **The T1 tool-recovery tier needs a tool-capable harness.** The `ollama` control adapter only
  writes files (no shell tool), so it cannot attempt tool-recovery tasks — which is itself the
  honest signal that a thin harness lacks that capacity. Demonstrating T1 requires `pi`/`hermes`/
  `claude` wired with their tools.
- **Compute**: the full `harness × model × seed × task` grid is large; keep the default battery
  small and log any cap — never silently truncate.
