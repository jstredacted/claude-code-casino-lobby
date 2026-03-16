import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { loadSettings } from "./settings.js";

const DEFAULT_PATH = `${process.env.HOME}/.claude/casino/bankroll.json`;

export interface Bankroll {
  balance: number;
  hands_played: number;
}

export function loadBankroll(path: string = DEFAULT_PATH): Bankroll {
  const { startingBalance } = loadSettings();
  if (!existsSync(path)) {
    return { balance: startingBalance, hands_played: 0 };
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { balance: startingBalance, hands_played: 0 };
  }
}

export function saveBankroll(bankroll: Bankroll, startingBalance?: number, path: string = DEFAULT_PATH): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  if (bankroll.balance <= 0) {
    const refill = startingBalance ?? loadSettings().startingBalance;
    bankroll.balance = refill;
  }

  writeFileSync(path, JSON.stringify(bankroll, null, 2));
}
