import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

export interface CasinoSettings {
  chips: number[];
  startingBalance: number;
}

export const DEFAULT_CHIPS = [10, 25, 50, 100];
export const DEFAULT_STARTING_BALANCE = 2500;
const MIN_STARTING_BALANCE = 100;
const MAX_STARTING_BALANCE = 1_000_000;
const DEFAULT_PATH = `${process.env.HOME}/.claude/casino/settings.json`;

function isValidChips(chips: unknown): chips is number[] {
  return (
    Array.isArray(chips) &&
    chips.length === 4 &&
    chips.every((v) => typeof v === "number" && Number.isInteger(v) && v >= 1)
  );
}

function isValidStartingBalance(val: unknown): val is number {
  return (
    typeof val === "number" &&
    Number.isInteger(val) &&
    val >= MIN_STARTING_BALANCE &&
    val <= MAX_STARTING_BALANCE
  );
}

export function loadSettings(path: string = DEFAULT_PATH): CasinoSettings {
  const defaults = { chips: DEFAULT_CHIPS, startingBalance: DEFAULT_STARTING_BALANCE };
  if (!existsSync(path)) return defaults;
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return {
      chips: data && isValidChips(data.chips) ? data.chips : DEFAULT_CHIPS,
      startingBalance: data && isValidStartingBalance(data.startingBalance)
        ? data.startingBalance
        : DEFAULT_STARTING_BALANCE,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: CasinoSettings, path: string = DEFAULT_PATH): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2));
}
