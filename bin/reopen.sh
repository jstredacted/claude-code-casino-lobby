#!/bin/bash
# Reopen casino after user dismissed it
DISMISSED_FILE="$HOME/.claude/casino/.casino.dismissed"
rm -f "$DISMISSED_FILE"

# Delegate to launch script
exec "$HOME/.claude/casino/bin/launch.sh"
