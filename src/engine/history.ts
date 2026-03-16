import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { BaccaratResult } from "./baccarat";

export interface BaccaratHistoryEntry {
  winner: "player" | "banker" | "tie";
}

const MAX_ENTRIES = 20;
const DEFAULT_PATH = `${process.env.HOME}/.claude/casino/history.json`;

export function loadHistory(path: string = DEFAULT_PATH): BaccaratHistoryEntry[] {
  if (!existsSync(path)) return [];
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: BaccaratHistoryEntry[], path: string = DEFAULT_PATH): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(entries));
}

export function addResult(entries: BaccaratHistoryEntry[], winner: BaccaratResult): BaccaratHistoryEntry[] {
  const next = [...entries, { winner }];
  if (next.length > MAX_ENTRIES) {
    return next.slice(next.length - MAX_ENTRIES);
  }
  return next;
}
