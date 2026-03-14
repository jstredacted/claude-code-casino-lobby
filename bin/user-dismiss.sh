#!/bin/bash
# Called when user voluntarily exits casino - suppresses auto-reopen
DISMISSED_FILE="$HOME/.claude/casino/.casino.dismissed"
PID_FILE="$HOME/.claude/casino/.casino.pid"
LOCK_FILE="$HOME/.claude/casino/.casino.lock"

# Mark as dismissed
touch "$DISMISSED_FILE"

# Kill process if running
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  kill -0 "$PID" 2>/dev/null && kill -TERM "$PID"
  sleep 0.3
  kill -0 "$PID" 2>/dev/null && kill -9 "$PID"
  rm -f "$PID_FILE"
fi

rm -f "$LOCK_FILE"
