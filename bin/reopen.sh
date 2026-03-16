#!/bin/bash
# Reopen casino after user dismissed it
DISMISSED_FILE="$HOME/.claude/casino/.casino.dismissed"
PID_FILE="$HOME/.claude/casino/.casino.pid"
LOCK_FILE="$HOME/.claude/casino/.casino.lock"
BUN="${BUN:-$(command -v bun)}"
ZELLIJ="${ZELLIJ_PATH:-$(command -v zellij)}"

# Clear dismissed flag
rm -f "$DISMISSED_FILE"

# Don't reopen if already running
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  exit 0
fi

# Must be in Zellij
if [ -z "$ZELLIJ" ]; then
  echo "Casino requires Zellij."
  exit 1
fi

rm -f "$LOCK_FILE" "$PID_FILE"

# Launch floating pane directly
"$ZELLIJ" run --floating --name "casino" --close-on-exit -- bash -c "
  echo \$\$ > \"$PID_FILE\"
  cd \"$HOME/.claude/casino\"
  \"$BUN\" run src/index.tsx
  rm -f \"$PID_FILE\" \"$LOCK_FILE\"
" &

exit 0
