import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

export interface CasinoSettings {
  chips: number[];
}

export const DEFAULT_CHIPS = [10, 25, 50, 100];
const DEFAULT_PATH = `${process.env.HOME}/.claude/casino/settings.json`;

function isValidChips(chips: unknown): chips is number[] {
  return (
    Array.isArray(chips) &&
    chips.length === 4 &&
    chips.every((v) => typeof v === "number" && Number.isInteger(v) && v >= 1)
  );
}

export function loadSettings(path: string = DEFAULT_PATH): CasinoSettings {
  if (!existsSync(path)) return { chips: DEFAULT_CHIPS };
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    if (data && isValidChips(data.chips)) {
      return { chips: data.chips };
    }
    return { chips: DEFAULT_CHIPS };
  } catch {
    return { chips: DEFAULT_CHIPS };
  }
}

export function saveSettings(settings: CasinoSettings, path: string = DEFAULT_PATH): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2));
}
