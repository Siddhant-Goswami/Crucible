#!/usr/bin/env node
// telegram-bot.js — control the agent fleet from Telegram.
//
// A thin bridge: it long-polls Telegram (getUpdates — no public URL / webhook
// needed, so it runs fine on localhost or a $4 VPS behind NAT) and translates
// chat commands into calls against the panel's HTTP API. Dashboard and chat stay
// in sync because both hit the same control plane.
//
// Setup (2 minutes):
//   1. Talk to @BotFather in Telegram -> /newbot -> copy the token.
//   2. Get your chat id: message the bot, then open
//      https://api.telegram.org/bot<TOKEN>/getUpdates and read message.chat.id
//   3. Run:
//        TELEGRAM_BOT_TOKEN=123:abc TELEGRAM_ALLOWED_CHATS=<your-chat-id> \
//          PANEL_URL=http://127.0.0.1:8088 node telegram-bot.js
//      (panel.js must be running.)
//
// Commands:
//   /nodes                       health of every agent instance
//   /run <task> <adapter> [node] launch a loop (default node = local)
//   /runs                        last few runs across the fleet
//   /cost                        spend so far (measured tokens)
//   /help
//
// Safety: TELEGRAM_ALLOWED_CHATS is a comma-separated allowlist. Messages from
// any other chat are ignored — never run an open bot that can spawn processes.
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PANEL = process.env.PANEL_URL || 'http://127.0.0.1:8088';
const ALLOW = (process.env.TELEGRAM_ALLOWED_CHATS || '').split(',').map(s => s.trim()).filter(Boolean);
if (!TOKEN) { console.error('set TELEGRAM_BOT_TOKEN (and TELEGRAM_ALLOWED_CHATS). See header for setup.'); process.exit(1); }
const API = `https://api.telegram.org/bot${TOKEN}`;

const api = (m, body) => fetch(`${API}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const panel = (p, opt) => fetch(`${PANEL}${p}`, opt).then(r => r.json());
const reply = (chat, text) => api('sendMessage', { chat_id: chat, text, parse_mode: 'Markdown', disable_web_page_preview: true });

async function handle(chat, text) {
  const [cmd, ...args] = text.trim().split(/\s+/);
  try {
    if (cmd === '/start' || cmd === '/help') {
      return reply(chat, '*nemo-claw fleet*\n`/nodes` — instance health\n`/run <task> <adapter> [node]` — launch a loop\n`/runs` — recent runs\n`/cost` — spend so far');
    }
    if (cmd === '/nodes') {
      const { nodes } = await panel('/api/nodes');
      return reply(chat, nodes.map(n => `${n.ok ? '🟢' : '🔴'} *${n.name}* (${n.kind}) — ${n.ok ? (n.adapters || []).length + ' adapters' + (n.running != null ? `, running ${n.running}` : '') : 'down: ' + (n.error || '')}`).join('\n'));
    }
    if (cmd === '/run') {
      const [task = 'hello-sum', adapter = 'mock', node = 'local'] = args;
      const r = await panel('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task, adapter, node }) });
      return reply(chat, r.error ? `✗ ${r.error}` : `▶️ launched *${task}* / *${adapter}* on *${node}*\n\`${r.runId || ''}\`\n_use /runs in a few seconds to see the result_`);
    }
    if (cmd === '/runs') {
      const { runs } = await panel('/api/runs?limit=8');
      if (!runs.length) return reply(chat, 'no runs yet — try `/run hello-sum ollama`');
      return reply(chat, runs.map(r => `${r.result === 'passed' ? '✅' : '❌'} *${r.task}*/${r.adapter} @${r.node} — ${r.iterations} it, ${r.wall_ms}ms, ${r.tokens_out || 0} tok`).join('\n'));
    }
    if (cmd === '/cost') {
      const c = await panel('/api/cost');
      const lines = Object.entries(c.byAdapter || {}).map(([a, v]) => `• ${a}: ${v.runs} runs — $${v.usd.toFixed(6)} (${v.model})`);
      return reply(chat, `*Total: $${c.totalUsd.toFixed(6)}* over ${c.runs} runs\n${lines.join('\n')}`);
    }
    return reply(chat, 'unknown command — /help');
  } catch (e) { return reply(chat, `error: ${e.message}`); }
}

let offset = 0;
async function poll() {
  try {
    const r = await fetch(`${API}/getUpdates?timeout=30&offset=${offset}`, { signal: AbortSignal.timeout(35000) }).then(r => r.json());
    for (const u of r.result || []) {
      offset = u.update_id + 1;
      const msg = u.message; if (!msg || !msg.text) continue;
      const chat = String(msg.chat.id);
      if (ALLOW.length && !ALLOW.includes(chat)) { console.log(`ignored chat ${chat}`); continue; }
      console.log(`[${chat}] ${msg.text}`);
      await handle(chat, msg.text);
    }
  } catch (e) { if (!String(e).includes('aborted')) console.error('poll error', e.message); }
  setImmediate(poll);
}
console.log(`telegram bridge -> ${PANEL}  (allowlist: ${ALLOW.length ? ALLOW.join(',') : 'OPEN — set TELEGRAM_ALLOWED_CHATS!'})`);
poll();
