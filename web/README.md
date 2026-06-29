# hermes-control-panel — Vercel control plane (`web/`)

A **serverless** version of the control panel, deployable to Vercel. Because Vercel
functions are ephemeral (no long-running process, no `bash`, no persistent disk, and
they can only reach **publicly-addressable** machines), this is a thin **stateless
control plane**: it serves the dashboard and **proxies** to remote `agent-node.js`
daemons that have public URLs. It does **not** run loops itself or keep a local
ledger — the workers do that.

```
Browser ──▶ Vercel (this app)  ──HTTPS──▶ public agent-node @ your VPS
            api/{nodes,run,runs,cost}      (runs loop.sh, owns runs.jsonl)
```

## Live deployment

- **Demo:** https://web-rosy-xi-23.vercel.app — read-only sample data (no real nodes), runs disabled.
- Scope/team: `100x-engineers`.

## Local structure

| Path | Role |
|---|---|
| `public/index.html` | the dashboard (token-aware; shows a DEMO banner until live) |
| `api/nodes.js` | health of every node (fan-out to each `/health`) |
| `api/runs.js` | merged run ledger (fan-out to each `/runs`) |
| `api/cost.js` | prices the merged ledger from measured tokens |
| `api/run.js` | proxy a launch to a node's `/run` (gated; off in demo) |
| `api/_lib.js` | config-from-env, auth, pricing, demo data |

## Going live (connect real worker nodes)

By default (no `NODES` env var) the panel is in **read-only demo mode**. To control
a real fleet:

1. **Stand up a public agent-node.** On a VPS with a public hostname + HTTPS:
   ```bash
   AGENT_TOKEN=$(openssl rand -hex 16) NODE_NAME=vps-1 BIND=0.0.0.0 PORT=7077 node agent-node.js
   ```
   Put it behind a TLS reverse proxy (Caddy/nginx) so Vercel can reach it over `https://`.
   *(Vercel cannot reach localhost/SSH-tunnel nodes — those only work with the local
   `panel.js`. For laptop-only fleets, use `panel.js` instead of this Vercel app.)*

2. **Set Vercel env vars** (server-side; node tokens never reach the browser):
   ```bash
   npx vercel@latest env add NODES production --scope 100x-engineers
   #   value: [{"name":"vps-1","url":"https://agents.you.com","token":"<AGENT_TOKEN>"}]
   npx vercel@latest env add PANEL_TOKEN production --scope 100x-engineers
   #   value: a long random secret — the dashboard prompts for it once
   ```

3. **Redeploy:**
   ```bash
   npx vercel@latest deploy web --prod --yes --scope 100x-engineers
   ```

## Security (a public panel can trigger execution — lock it down)

- **`PANEL_TOKEN` is required to enable runs** (fail-closed): with `NODES` set but no
  `PANEL_TOKEN`, `/api/run` returns 403. With `PANEL_TOKEN` set, every API call must
  send the `x-panel-token` header (the dashboard prompts once, stores in localStorage).
- **Agent-nodes need their own `AGENT_TOKEN`** (bearer) and HTTPS. Never expose a raw
  `agent-node` to the internet without both.
- Consider Vercel **Deployment Protection** (password / SSO) as defense-in-depth.
- Scope each node's API key minimally; the panel can do whatever the node allows.
