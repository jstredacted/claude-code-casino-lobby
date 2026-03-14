import React from "react";
import { render } from "ink";
import { writeFileSync } from "fs";
import { App } from "./App.js";
import { loadBankroll, saveBankroll } from "./bankroll.js";

const DISMISSED_FILE = `${process.env.HOME}/.claude/casino/.casino.dismissed`;

// Enter alternate screen buffer
process.stdout.write("\x1b[?1049h");

const app = render(<App />);

function shutdown() {
  const bankroll = loadBankroll();
  saveBankroll(bankroll);
  app.unmount();
  process.stdout.write("\x1b[?1049l");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.waitUntilExit();

// User quit voluntarily (not SIGTERM from hook)
writeFileSync(DISMISSED_FILE, String(Date.now()));
process.stdout.write("\x1b[?1049l");
