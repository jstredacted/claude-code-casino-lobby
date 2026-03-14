#!/bin/bash
# Kills the casino process; Zellij pane auto-closes when process exits

PID_FILE="$HOME/.claude/casino/.casino.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill -TERM "$PID"
    sleep 0.3
    kill -0 "$PID" 2>/dev/null && kill -9 "$PID"
  fi
  rm -f "$PID_FILE"
fi
