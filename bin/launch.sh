#!/bin/bash
# Launches casino as a Zellij floating pane (idempotent)

PID_FILE="$HOME/.claude/casino/.casino.pid"

# Only launch if inside a Zellij session
if [ -z "$ZELLIJ" ]; then
  exit 0
fi

# Idempotent: don't launch if already running (PID-based, crash-safe)
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  exit 0
fi

# Launch as a floating pane in Zellij (backgrounded so hook doesn't block)
zellij run --floating --name "casino" -- bash -c "
  echo \$\$ > \"$PID_FILE\"
  cd \"$HOME/.claude/casino\"
  bun run src/index.tsx
  rm -f \"$PID_FILE\"
" &

exit 0
