#!/usr/bin/env bash
# run-detached.sh — run a Crucible battery DURABLY: independent of any terminal/agent session and
# kept awake through the night. Uses a macOS launchd LaunchAgent (so the job is reparented to
# launchd and survives the launching process being killed — the root cause of earlier SIGTERMs)
# wrapped in `caffeinate` (no idle/system sleep mid-run). The battery itself is resumable, so an
# interruption just continues from the ledger.
#
# Usage:
#   ./crucible/run-detached.sh start     # generate the LaunchAgent + start the battery (default)
#   ./crucible/run-detached.sh status    # is it running? + tail the log
#   ./crucible/run-detached.sh stop      # stop + remove the LaunchAgent
#
# Pass-through env (baked into the job): RESUME (default 1), RUN_CLAUDE, LOCAL_HARNESSES,
# LOCAL_MODELS, SEEDS, TASKS, LEDGER. Example:
#   RUN_CLAUDE=1 LOCAL_MODELS="deepseek-r1:1.5b,qwen3:8b,deepseek-r1:8b" ./crucible/run-detached.sh start
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.crucible.battery"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$ROOT/crucible/results/bench.log"
DOMAIN="gui/$(id -u)"
CMD="${1:-start}"

emit_plist() {
  mkdir -p "$HOME/Library/LaunchAgents" "$ROOT/crucible/results"
  # caffeinate -i -s: no idle sleep, no system sleep on AC, until bench.sh exits.
  # RESUME defaults to 1 so a relaunch continues the ledger rather than truncating.
  cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string><string>-i</string><string>-s</string>
    <string>/bin/bash</string><string>$ROOT/crucible/bench.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
  <key>RunAtLoad</key><true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$HOME/.local/bin:$HOME/.hermes/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key><string>$HOME</string>
    <key>RESUME</key><string>${RESUME:-1}</string>
    <key>RUN_CLAUDE</key><string>${RUN_CLAUDE:-}</string>
    <key>LOCAL_HARNESSES</key><string>${LOCAL_HARNESSES:-}</string>
    <key>LOCAL_MODELS</key><string>${LOCAL_MODELS:-}</string>
    <key>SEEDS</key><string>${SEEDS:-}</string>
    <key>TASKS</key><string>${TASKS:-}</string>
    <key>LEDGER</key><string>${LEDGER:-}</string>
    <key>CRZ_THINK</key><string>${CRZ_THINK:-}</string>
  </dict>
</dict>
</plist>
PL
}

case "$CMD" in
  start)
    emit_plist
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$PLIST" 2>/dev/null || launchctl load -w "$PLIST"
    launchctl kickstart "$DOMAIN/$LABEL" 2>/dev/null || true
    echo "started '$LABEL' (detached + caffeinated)."
    echo "  monitor: tail -f \"$LOG\""
    echo "  status:  ./crucible/run-detached.sh status"
    echo "  stop:    ./crucible/run-detached.sh stop"
    ;;
  status)
    if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
      echo "RUNNING ($LABEL). last log lines:"; tail -n 12 "$LOG" 2>/dev/null | sed 's/^/  /'
    else
      echo "not running ($LABEL). last log lines:"; tail -n 12 "$LOG" 2>/dev/null | sed 's/^/  /'
    fi
    ;;
  stop)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || launchctl unload -w "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "stopped + removed '$LABEL'. (the ledger is intact; resume with start.)"
    ;;
  *) echo "usage: $0 {start|status|stop}" >&2; exit 1 ;;
esac
