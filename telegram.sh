#!/usr/bin/env bash
# telegram.sh — one command to run the fleet from Telegram.
#
# Starts the control panel (if it isn't already up) and the Telegram bridge,
# reading your token from the gitignored .env.telegram. Never put the token on
# the command line — it would leak into shell history and `ps` output.
#
#   cp .env.telegram.example .env.telegram   # then fill it in
#   ./telegram.sh
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env.telegram ] || { echo "Missing .env.telegram — run:  cp .env.telegram.example .env.telegram  and fill it in."; exit 1; }
set -a; . ./.env.telegram; set +a
: "${TELEGRAM_BOT_TOKEN:?set TELEGRAM_BOT_TOKEN in .env.telegram}"
: "${TELEGRAM_ALLOWED_CHATS:?set TELEGRAM_ALLOWED_CHATS in .env.telegram (run: node telegram-whoami.js to find your chat id)}"
PORT="${PANEL_PORT:-8088}"

if ! curl -s "http://127.0.0.1:$PORT/api/meta" >/dev/null 2>&1; then
  echo "starting control panel on :$PORT ..."
  PORT="$PORT" node panel.js >/tmp/nemo-panel.log 2>&1 &
  for i in 1 2 3 4 5; do curl -s "http://127.0.0.1:$PORT/api/meta" >/dev/null 2>&1 && break; sleep 0.4; done
fi

echo "panel:    http://127.0.0.1:$PORT"
echo "telegram: bridging (allowlist: $TELEGRAM_ALLOWED_CHATS)  — try /nodes in your bot"
PANEL_URL="http://127.0.0.1:$PORT" exec node telegram-bot.js
