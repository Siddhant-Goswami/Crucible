# nemo-claw — Learnings: running 100x-loops on lean agent harnesses

**Goal of this exercise.** Deep-research the current crop of "safe and lean" agent
harnesses (Nemo, Hermes, OpenClaw, and friends), **pick one**, and build a working
prototype that drives the [100x-loops](https://github.com/Siddhant-Goswami/100x-loops)
loop pattern through it — then test and compare, documenting everything.

**TL;DR**
- The 100x-loops thesis is *"who owns the loop"*: `act → verify (rules-based) → exit 0 (done) | exit 2 (keep going) → repeat`, bounded.
- That pattern is **harness-agnostic**. The loops already prove it with a `GRADER=mock|claude` seam. I generalized that seam into a **pluggable adapter interface** so any harness can be the "brain."
- **The pick: Hermes Agent (Nous Research)** as the recommended *production* harness — because its skill format **is** the same `agentskills.io` standard the loops already use, its `hermes -z` headless mode is a perfect loop adapter, and it has the strongest safety model of the lean options.
- **What I actually ran here (safe + lean + $0):** a **local Ollama model (qwen3:8b)** as a drop-in adapter — no API key, no network off-box, no install. It drove both the portable `hello-sum` loop **and your real `01-grading-loop`** to completion, and — crucially — the rules-based gate caught a genuine model inconsistency and forced the loop to self-correct / escalate.

---

## 1. The harness landscape (research)

I evaluated each on the axes that matter for "safe + lean to run *now*": install
weight, host isolation, whether it can run offline/bounded, and how cleanly it
plugs into an external loop. Full source links in §8.

### The contenders

| Harness | What it is | Lang / install | Lean? | Safe (host isolation)? | Offline-capable | Loop-fit (headless one-shot) |
|---|---|---|---|---|---|---|
| **Hermes Agent** (NousResearch) | Self-hosted always-on personal agent; self-improving skills | `curl\|bash`; Python 3.11 + Node 22 + Playwright | Medium (heavy install, light runtime) | **Strong**: command-approval + hardline blocklist + `tirith` scanner + SSRF guard + `docker`/`ssh`/`modal`/`daytona` sandbox backends | **Yes** (point model at local Ollama) | **Yes** — `hermes -z` "prompt in, final text out" |
| **nemo-agent** (truemagic-coder) | Lean autonomous *coding* agent; TDD generate→test→lint→fix loop | `uvx nemo-agent`; Python 3.10+ | **Leanest install** | **Weak**: runs AI-generated code directly on host, **no sandbox** | Yes (Ollama `mistral-nemo`) | Yes — `uvx nemo-agent "task"` (greenfield scaffolds) |
| **OpenClaw** (openclaw/openclaw) | Self-hosted multi-channel gateway that bridges chat apps → coding agents via ACP | `npm i -g openclaw`; Node 24 | Light to host (~512 MB) | Medium: local-first + per-runtime/ACP session isolation | Partial (Ollama routing) | Indirect — it's a gateway daemon, not a one-shot driver |
| **NVIDIA NeMo Agent Toolkit** | Enterprise multi-agent orchestration + observability/eval/profiling | `pip install nvidia-nat`; Python 3.11–13 | **No** — meta-framework, NIM/GPU-oriented | N/A (platform) | No (NIM endpoints) | No |
| **ruvnet/agent-harness-generator** | Meta-harness "factory" that *scaffolds* branded harnesses (targets Claude Code, Codex, pi.dev, Hermes, OpenClaw, RVM…) | `npx metaharness`; Node + Rust/WASM kernel | Light (static analysis, no code-exec) | Generates default-deny MCP + signed releases; **but beta/aspirational, a scan flagged a high-severity issue** | n/a (generator) | n/a |

### Disambiguation notes (these names collide — worth pinning down)
- **"Nemo" is overloaded.** The lean one is **`nemo-agent`** by truemagic-coder (named after Mistral **NeMo**, its default local Ollama model). It is *not* NVIDIA's heavyweight **NeMo Agent Toolkit**. The working dir `nemo-claw` most plausibly = `nemo-agent` (lean coding agent) + **`claw`/OpenClaw** (lean gateway).
- **Hermes ≈ the OpenClaw successor.** Hermes ships `hermes claw migrate` and `openclaw-imports/`, i.e. it's a migration target for the earlier "OpenClaw" agent. (Separately, there's an unrelated legacy "OpenClaw" Captain-Claw game engine — ignore it.)
- **Heavy SEO-spam / look-alike domains** surround Hermes and OpenClaw (wildly inconsistent star counts, fake stat pages). **Trust only `github.com/NousResearch/*`, `hermes-agent.nousresearch.com`, `github.com/openclaw/openclaw`, `docs.openclaw.ai`.**

---

## 2. The pick, and why

**Pick: Hermes Agent** as the recommended production harness; **local Ollama** as
the safe/lean thing to actually *run* today.

Why Hermes wins on the "use my loops with it" criterion specifically:

1. **Skill-format identity.** The 100x-loops encode workflows as
   `.claude/skills/<name>/SKILL.md` (the `agentskills.io` standard). **Hermes uses
   the exact same standard** (`~/.hermes/skills/`, `SKILL.md` with frontmatter,
   progressive disclosure, even a "Verification — smoke tests" convention). So a
   loop's `/grade` skill is *portable to Hermes with near-zero change* — no other
   harness gives you that.
2. **Headless mode = loop adapter.** `hermes -z "<prompt>"` is purpose-built:
   "single prompt in, final response text out, nothing else." That is exactly the
   adapter contract a shell-owned loop needs. (nemo-agent's `uvx nemo-agent` is
   greenfield-oriented; OpenClaw is a daemon/gateway, not a one-shot.)
3. **Safety.** Of the lean options, Hermes has by far the deepest guardrails:
   command-approval modes (`manual`/`smart`/`off`), an un-overridable hardline
   blocklist (`rm -rf /`, fork bombs, pipe-to-shell), the `tirith` pre-exec
   scanner, an SSRF guard (blocks RFC-1918/metadata by default), credential
   stripping, and real sandbox backends (`docker`/`ssh`/`modal`/`daytona`).
   `nemo-agent` has **none** of this (it runs model-written code on your host).
4. **Offline + bounded.** Point `model.provider: custom` at
   `http://localhost:11434/v1` (Ollama) for fully offline inference; `agent.max_turns`
   (default 90) + budget nudges bound every run.

Where the others still earn a place in the prototype:
- **Local Ollama adapter** is what's genuinely *safe + lean + $0 today* with **no
  install** — so it's the live demo. (It's also exactly the model endpoint Hermes
  would call, so the Hermes path is a one-line swap.)
- **nemo-agent** stays documented as the *leanest install*, with its lack of
  sandbox called out — run it inside a container if you value your filesystem.

---

## 3. What I built (prototype architecture)

A harness-agnostic loop runner that generalizes the loops' `GRADER=mock|claude`
seam into a full **adapter interface**:

```
nemo-claw/
├── loop.sh                 # the harness-AGNOSTIC bounded loop: act→verify→exit0/2, max-iters, sandboxed
├── adapters/               # swappable "brains" — all share ONE contract
│   ├── mock.sh             #   deterministic, offline, $0 (baseline)
│   ├── ollama.sh           #   REAL local model via Ollama HTTP API (offline, $0)  ← run live here
│   ├── claude.sh           #   `claude -p` headless (real, spends tokens; opt-in)
│   ├── hermes.sh           #   `hermes -z` headless (THE pick; opt-in install)
│   └── nemo.sh             #   `uvx nemo-agent` (leanest install; no sandbox; opt-in)
├── tasks/hello-sum/        # portable task mirroring loops/00-hello-loop
│   ├── TASK.md  sum.js  sum.test.js  verify.sh
├── compare.sh              # run the SAME task across all AVAILABLE adapters → results/comparison.md
├── loops/                  # the cloned 100x-loops, with a GRADER=ollama backend added to 01
└── results/comparison.md   # generated
```

**Adapter contract** (one line): `adapters/<name>.sh <workdir> <iter> <feedback-file>`
— read the goal from `TASK.md`, read last verifier feedback, make **one** attempt
by editing files in `workdir`. The loop calls `verify.sh` after each attempt and
feeds `exit 2` output back into the next iteration.

**Safety properties baked in** (mirroring the loops' own conventions):
- **Bounded** — `MAX_ITERS` caps every run; nothing loops forever.
- **Sandboxed side effects** — the loop copies the task into a disposable
  `.runs/<task>.<adapter>/` workdir; the pristine task is never mutated.
- **Observable** — per-iteration adapter time + verdict logged; `result.json` emitted.
- **Offline-first** — the default runnable adapters (`mock`, `ollama`) make no
  off-box network calls and cost $0; token-spending adapters are opt-in.

**Integration with the real loops:** I added a `GRADER=ollama` branch to
`loops/01-grading-loop/scripts/grade-all.sh` (+ `scripts/ollama-grader.sh`), a
faithful one-branch extension of the repo's own `mock|claude` seam — so the *actual*
grading loop now runs on a local model.

---

## 4. Empirical results (real runs on this machine)

Environment: macOS, `node v20`, `ollama` with `qwen3:8b` (already pulled), no
Hermes/Docker installed, `OPENROUTER_API_KEY` present but unused (we stayed offline).

### 4a. `hello-sum` — fix a one-line bug until `node --test` passes

| Harness | Result | Iterations | Wall time | Cost | Offline |
|---------|--------|-----------:|----------:|------|:-------:|
| mock    | passed | 1 | ~0.5 s | $0 (no model) | ✅ |
| ollama (qwen3:8b) | passed | 1 | ~2.8 s | $0 (local) | ✅ |
| claude / hermes | (opt-in) | — | — | — | — |

Both converge in 1 iteration on this easy task. The point of this task is to prove
the *machinery*: the loop, the sandbox, the rules-based gate, the adapter swap.
Adapter-only latency for the local model was ~2.4 s/attempt with `think:false`.

### 4b. `01-grading-loop` — the real loop, mock vs. local model

```
GRADER=mock:    alice→AUTO(pass)  bob→AUTO(fail)  carol→REVIEW(0.62)  dave→REVIEW(flagged)
GRADER=ollama:  alice→AUTO(pass,0.95)  bob→REVIEW(fail,0.6)  carol→AUTO(partial,0.9)  dave→FAILED→human
```

The standout moment — **the loop self-correcting against a fallible real model:**

> `dave` is the "gaming the rubric" submission. qwen3:8b graded its criteria
> `correctness=partial, completeness=pass, clarity=fail` but then wrote
> `overall="fail"`. The rubric's verdict mapping says that combination is
> **`partial`**, not `fail`. `verify-grade.sh` caught the cross-field
> inconsistency (`overall=fail but rubric mapping implies partial`), rejected the
> grade, and the bounded inner loop retried 3× — each time the model repeated the
> same logical error, so after `MAX_ITERS` the submission was **routed to a human**.

That is the entire 100x-loops thesis demonstrated in one event: a **deterministic,
rules-based verifier caught a mistake a real LLM kept making** — and an LLM-as-judge
would almost certainly have rubber-stamped (the model's *prose reasoning* sounded
perfectly plausible). Rules-based verification isn't a nicety; it's the load-bearing wall.

---

## 5. Key learnings & gotchas (discovered while building)

1. **The loop is the portable primitive; the harness is a plug-in.** Once you own
   the loop in shell (`loop.sh`) and define a one-line adapter contract, swapping
   mock → local model → Hermes → Claude is trivial. The loops repo already hinted
   this with `GRADER=mock|claude`; generalizing it is the whole prototype.

2. **Rules-based verification > LLM-judge, proven, not asserted.** §4b is the
   receipt. The verifier is `jq` + a schema + one cross-field assertion — free,
   instant, deterministic — and it caught an inconsistency the model couldn't.

3. **"Thinking" models need handling.** qwen3/deepseek-r1 emit chain-of-thought.
   - `ollama run <model> "prompt"` leaks **TTY spinner/cursor escape codes** into
     stdout *even when piped* — unusable for scripting.
   - **Fix: call the HTTP API** (`POST /api/generate`, `stream:false`) — clean JSON.
   - **`think:false`** disables reasoning: dropped a `hello-sum` attempt from
     **~20 s → ~1.7 s** and stopped reasoning prose leaking into the file.
   - Wrap structured output in **sentinels** (`===BEGIN===`/`===END===`) and extract,
     or use `format:"json"` for JSON tasks — robust against stray commentary.

4. **Defensive adapters keep failures honest.** The ollama adapter only overwrites
   `sum.js` if the output contains `module.exports`; a bad generation leaves the
   file untouched, so the verifier fails cleanly and the loop retries/​bounds out —
   never a half-corrupted file masquerading as progress.

5. **Sandbox the work, not just the model.** The biggest *real* risk in these lean
   harnesses isn't the model — it's that `nemo-agent` (and Hermes on `terminal.backend:
   local`) execute generated code on your host. The loop copying each task into a
   throwaway `.runs/` dir is the cheap mitigation; a container backend is the real one.

6. **A weaker model changes the *escalation profile*, not just accuracy.** qwen3
   auto-cleared `carol` (mock escalated her) and escalated `bob` (mock auto-cleared).
   The loop still did its job — surfacing uncertainty to a human — which is exactly
   why the confidence gate + human-review queue exist. Stronger model ⇒ fewer
   escalations ⇒ cheaper human review, but the *safety* doesn't depend on model quality.

7. **Install weight ≠ runtime weight.** Hermes is heavy to *install* (Node 22 +
   Playwright Chromium + ffmpeg) but light to *run* (a Python process; $0 idle).
   Don't conflate the two when judging "lean."

8. **`curl|bash` + SEO-spam = supply-chain caution.** Read Hermes' `install.sh`
   first; only trust the NousResearch GitHub + official domain. Container backends
   also *skip* the dangerous-command checks (the container is the boundary) — so
   "docker" is a *different* boundary, not "more checks." Never `--yolo` on `local`.

---

## 6. Wiring Hermes live (the opt-in production path)

The prototype is ready for it — `adapters/hermes.sh` already implements the
contract. To switch the live harness from local-Ollama to Hermes:

```bash
# 1) Install (review the script first; trust only the official domain)
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.zshrc

# 2) Make it SAFE + LEAN + OFFLINE: point it at the SAME local Ollama we already use
hermes config set model.provider custom
hermes config set model.base_url http://localhost:11434/v1
hermes config set model.name qwen3:8b
hermes config set terminal.backend local     # leanest; use 'docker' for real isolation
# keep command-approval = manual (default); do NOT use --yolo on the local backend

# 3) Run the exact same loop, now driven by Hermes
./loop.sh tasks/hello-sum hermes 5
RUN_CLAUDE=0 ./compare.sh                     # hermes row now populates automatically
```

Because Hermes speaks the `agentskills.io` skill format, the loops' `/grade` skill
(`loops/01-grading-loop/.claude/skills/grade/SKILL.md`) can be copied to
`~/.hermes/skills/grade/` and invoked as `/grade` inside Hermes essentially as-is —
the cleanest possible "use my loops with this harness."

---

## 7. Recommendation

- **To learn / teach / run today, $0 and safe:** the **local-Ollama adapter** in
  this repo. No install, no key, no host risk beyond a sandboxed file write.
- **To productionize the loops as a persistent agent:** **Hermes**, pointed at a
  local model, `terminal.backend: docker`, command-approval `manual`. Best
  safety + native skill-format compatibility with the loops.
- **Avoid for "lean + safe":** NVIDIA NeMo Toolkit (heavy, GPU/NIM), and
  `nemo-agent` *unless* containerized (no sandbox). Treat
  `ruvnet/agent-harness-generator` as interesting-but-beta.

---

## 8. Sources

- 100x-loops — https://github.com/Siddhant-Goswami/100x-loops
- Hermes Agent — https://github.com/NousResearch/hermes-agent ·
  docs https://hermes-agent.nousresearch.com/docs ·
  security https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/security.md ·
  CLI https://hermes-agent.nousresearch.com/docs/reference/cli-commands
- nemo-agent — https://github.com/truemagic-coder/nemo-agent · https://pypi.org/project/nemo-agent/ · model https://ollama.com/library/mistral-nemo
- NVIDIA NeMo Agent Toolkit — https://github.com/NVIDIA/NeMo-Agent-Toolkit · https://docs.nvidia.com/nemo/agent-toolkit/
- OpenClaw — https://github.com/openclaw/openclaw · https://docs.openclaw.ai/
- ruvnet/agent-harness-generator — https://github.com/ruvnet/agent-harness-generator
- agentskills.io (skill standard) — https://agentskills.io
- Ollama API (used by the live adapter) — https://github.com/ollama/ollama/blob/main/docs/api.md
