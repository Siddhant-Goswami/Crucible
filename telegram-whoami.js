#!/usr/bin/env node
// telegram-whoami.js — print the chat IDs that have messaged your bot.
//
// Telegram doesn't tell you your own chat id directly; the trick is to message
// the bot, then read getUpdates. This does that for you.
//
// Usage (after you've sent your bot any message in Telegram):
//   set -a; . ./.env.telegram; set +a; node telegram-whoami.js
// or:
//   TELEGRAM_BOT_TOKEN=123:abc node telegram-whoami.js
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN not set. Put it in .env.telegram, then:\n  set -a; . ./.env.telegram; set +a; node telegram-whoami.js');
  process.exit(1);
}
fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates`).then(r => r.json()).then(j => {
  if (!j.ok) { console.error('Telegram API error:', j.description || j); process.exit(1); }
  const chats = {};
  for (const u of j.result || []) {
    const m = u.message || u.edited_message || u.channel_post;
    if (m && m.chat) chats[m.chat.id] = m.chat.username || m.chat.first_name || m.chat.title || '';
  }
  const ids = Object.keys(chats);
  if (!ids.length) {
    console.log('No messages found yet.\nOpen Telegram, send your bot any message (e.g. "hi"), then run this again.');
    return;
  }
  console.log('Chats that have messaged your bot:');
  for (const id of ids) console.log(`  ${id}\t${chats[id]}`);
  console.log('\nCopy the id into TELEGRAM_ALLOWED_CHATS in .env.telegram (comma-separated for more than one).');
}).catch(e => { console.error('network error:', e.message); process.exit(1); });
