#!/bin/bash
# Launches casino as a Zellij floating pane (idempotent)

LOCK_FILE="$HOME/.claude/casino/.casino.lock"
PID_FILE="$HOME/.claude/casino/.casino.pid"
DISMISSED_FILE="$HOME/.claude/casino/.casino.dismissed"
BUN="${BUN:-$(command -v bun)}"
ZELLIJ="${ZELLIJ_PATH:-$(command -v zellij)}"

# Only launch if inside a Zellij session
if [ -z "$ZELLIJ" ]; then
  exit 0
fi

# Don't launch if user dismissed casino this session
if [ -f "$DISMISSED_FILE" ]; then
  exit 0
fi

# Idempotent: don't launch if process is still alive
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  exit 0
fi

# Stale lock from a crashed pane — clean it up
rm -f "$LOCK_FILE" "$PID_FILE"

# Write lock BEFORE spawning pane to prevent race conditions
echo $$ > "$LOCK_FILE"

# Small delay to let Zellij settle
sleep 0.2

# Launch as a floating pane in Zellij (backgrounded so hook doesn't block)
"$ZELLIJ" run --floating --name "casino" --close-on-exit -- bash -c "
  echo \$\$ > \"$PID_FILE\"
  cd \"$HOME/.claude/casino\"
  \"$BUN\" run src/index.tsx
  rm -f \"$PID_FILE\" \"$LOCK_FILE\"
" &

# Wait briefly for pane to spawn
sleep 0.3

exit 0
