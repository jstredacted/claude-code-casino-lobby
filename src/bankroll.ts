import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

export const DEFAULT_BALANCE = 1000;
const DEFAULT_PATH = `${process.env.HOME}/.claude/casino/bankroll.json`;

export interface Bankroll {
  balance: number;
  hands_played: number;
}

export function loadBankroll(path: string = DEFAULT_PATH): Bankroll {
  if (!existsSync(path)) {
    return { balance: DEFAULT_BALANCE, hands_played: 0 };
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { balance: DEFAULT_BALANCE, hands_played: 0 };
  }
}

export function saveBankroll(bankroll: Bankroll, path: string = DEFAULT_PATH): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  if (bankroll.balance <= 0) {
    bankroll.balance = DEFAULT_BALANCE;
  }

  writeFileSync(path, JSON.stringify(bankroll, null, 2));
}
