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

export interface BigRoadCell {
  type: "player" | "banker" | "empty";
  ties: number;
}

const GRID_ROWS = 6;

export function computeBigRoad(entries: BaccaratHistoryEntry[]): BigRoadCell[][] {
  if (entries.length === 0) return [];

  // Phase 1: group into non-tie entries, tracking ties-after each
  interface StreakEntry { side: "player" | "banker"; tiesAfter: number }
  const nonTieEntries: StreakEntry[] = [];
  let pendingTies = 0;

  for (const entry of entries) {
    if (entry.winner === "tie") {
      pendingTies++;
      if (nonTieEntries.length > 0) {
        nonTieEntries[nonTieEntries.length - 1].tiesAfter += pendingTies;
        pendingTies = 0;
      }
    } else {
      nonTieEntries.push({ side: entry.winner, tiesAfter: 0 });
      if (pendingTies > 0) {
        // Ties before any non-tie result — discard
        pendingTies = 0;
      }
    }
  }

  if (nonTieEntries.length === 0) return [];

  // Phase 2: group non-tie entries into streak columns
  interface ColumnData { side: "player" | "banker"; ties: number[] }
  const streakColumns: ColumnData[] = [];
  let currentCol: ColumnData | null = null;

  for (const entry of nonTieEntries) {
    if (!currentCol || currentCol.side !== entry.side) {
      currentCol = { side: entry.side, ties: [entry.tiesAfter] };
      streakColumns.push(currentCol);
    } else {
      currentCol.ties.push(entry.tiesAfter);
    }
  }

  // Phase 3: place into grid with dragon tail
  const cellMap = new Map<string, BigRoadCell>();
  let maxRow = 0;
  let maxCol = 0;
  let gridCol = 0;

  for (const col of streakColumns) {
    let row = 0;
    for (let i = 0; i < col.ties.length; i++) {
      let r: number;
      let c: number;

      if (row < GRID_ROWS) {
        r = row;
        c = gridCol;
      } else {
        // Dragon tail: overflow rightward on bottom row
        const overflow = row - GRID_ROWS + 1;
        r = GRID_ROWS - 1;
        c = gridCol + overflow;
      }

      cellMap.set(`${r},${c}`, { type: col.side, ties: col.ties[i] });
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;

      row++;
    }

    // Next column starts after this one (accounting for dragon tail width)
    const dragonWidth = Math.max(0, col.ties.length - GRID_ROWS);
    gridCol = gridCol + 1 + dragonWidth;
  }

  // Phase 4: build [row][col] grid
  const grid: BigRoadCell[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: BigRoadCell[] = [];
    for (let c = 0; c <= maxCol; c++) {
      row.push(cellMap.get(`${r},${c}`) ?? { type: "empty", ties: 0 });
    }
    grid.push(row);
  }

  return grid;
}
