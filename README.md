# Claude Code Casino Lobby

A terminal UI casino that auto-launches in a [Zellij](https://zellij.dev/) floating pane while Claude Code dispatches background agents. Kill time while your AI works.

Built with [Ink](https://github.com/vadimdemedes/ink) (React for the terminal) and [Bun](https://bun.sh/).

## Games

### Free Double Blackjack
Standard blackjack with a twist: when your initial hand totals 9, 10, or 11, you get a **free double down** — double your bet without risking extra chips.

- Hit, Stand, Double Down, Double Up, Surrender, Insurance
- Card deal animations with face-down/flip reveals
- 6-deck shoe with automatic reshuffle

### Baccarat
Full baccarat with third-card tableau rules and interactive card reveals.

- Bet on Player, Banker, or Tie
- Press Space to reveal cards one at a time
- Big Road scoreboard tracks game history

## Features

- **Persistent bankroll** — balance saves between sessions
- **Customizable chip presets** — edit chip denominations inline
- **Auto-launch/dismiss** — integrates with Claude Code hooks to appear when agents spawn and disappear when they finish
- **Alternate screen buffer** — doesn't pollute your terminal scrollback

## Quick Start

```bash
bun install
bun run start
```

## Zellij Integration

The `bin/` scripts handle launching the casino as a floating Zellij pane. Wire them into [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) to auto-launch when background agents start:

```json
// .claude/settings.json
{
  "hooks": {
    "subagent_started": [
      { "command": "~/.claude/casino/bin/launch.sh" }
    ],
    "subagent_completed": [
      { "command": "~/.claude/casino/bin/dismiss.sh" }
    ],
    "session_start": [
      { "command": "~/.claude/casino/bin/session-start.sh" }
    ]
  }
}
```

## Controls

| Key | Action |
|-----|--------|
| Arrow keys | Navigate menus |
| Enter | Confirm / Next hand |
| H | Hit (Blackjack) |
| S | Stand (Blackjack) |
| D | Free Double (Blackjack, on 9-11) |
| X | Paid Double Down (Blackjack) |
| U | Double Up (Blackjack) |
| R | Surrender (Blackjack) |
| Y/N | Insurance (Blackjack) |
| P/B | Player/Banker (Baccarat) |
| Space | Reveal card (Baccarat) |
| A | All-in (Bet picker) |
| Q | Quit / Back to lobby |

## License

MIT
