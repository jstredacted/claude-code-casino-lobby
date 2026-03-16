import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadHistory, saveHistory, addResult, computeBigRoad, type BaccaratHistoryEntry, type BigRoadCell } from "./history";

describe("loadHistory", () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "casino-test-"));
    path = join(dir, "history.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test("returns empty array when file does not exist", () => {
    expect(loadHistory(path)).toEqual([]);
  });

  test("returns empty array on corrupted JSON", () => {
    Bun.write(path, "not json{{{");
    expect(loadHistory(path)).toEqual([]);
  });

  test("returns empty array when JSON is not an array", () => {
    Bun.write(path, '{"not": "an array"}');
    expect(loadHistory(path)).toEqual([]);
  });

  test("loads saved history", () => {
    const entries: BaccaratHistoryEntry[] = [
      { winner: "player" },
      { winner: "banker" },
    ];
    Bun.write(path, JSON.stringify(entries));
    expect(loadHistory(path)).toEqual(entries);
  });
});

describe("saveHistory", () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "casino-test-"));
    path = join(dir, "history.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test("writes entries to disk", () => {
    const entries: BaccaratHistoryEntry[] = [{ winner: "player" }];
    saveHistory(entries, path);
    expect(JSON.parse(readFileSync(path, "utf-8"))).toEqual(entries);
  });
});

describe("addResult", () => {
  test("appends entry", () => {
    const result = addResult([], "player");
    expect(result).toEqual([{ winner: "player" }]);
  });

  test("caps at 20 entries, dropping oldest", () => {
    const entries: BaccaratHistoryEntry[] = Array.from({ length: 20 }, () => ({ winner: "banker" as const }));
    const result = addResult(entries, "player");
    expect(result.length).toBe(20);
    expect(result[0]).toEqual({ winner: "banker" });
    expect(result[19]).toEqual({ winner: "player" });
  });

  test("does not mutate original array", () => {
    const entries: BaccaratHistoryEntry[] = [{ winner: "player" }];
    const result = addResult(entries, "banker");
    expect(entries.length).toBe(1);
    expect(result.length).toBe(2);
  });
});

// Helper: extract just types from grid for readable assertions
function gridTypes(grid: BigRoadCell[][]): string[][] {
  return grid.map(row => row.map(c => c.type === "empty" ? "." : c.type[0])); // p, b, or .
}

function gridTies(grid: BigRoadCell[][]): number[][] {
  return grid.map(row => row.map(c => c.ties));
}

describe("computeBigRoad", () => {
  test("empty entries returns empty grid", () => {
    const grid = computeBigRoad([]);
    expect(grid).toEqual([]);
  });

  test("single player win", () => {
    const grid = computeBigRoad([{ winner: "player" }]);
    expect(gridTypes(grid)).toEqual([["p"]]);
  });

  test("streak of 3 player wins stacks vertically", () => {
    const entries: BaccaratHistoryEntry[] = [
      { winner: "player" },
      { winner: "player" },
      { winner: "player" },
    ];
    const grid = computeBigRoad(entries);
    expect(gridTypes(grid)).toEqual([
      ["p"],
      ["p"],
      ["p"],
    ]);
  });

  test("alternating results create new columns", () => {
    const entries: BaccaratHistoryEntry[] = [
      { winner: "player" },
      { winner: "banker" },
      { winner: "player" },
    ];
    const grid = computeBigRoad(entries);
    expect(gridTypes(grid)).toEqual([
      ["p", "b", "p"],
    ]);
  });

  test("mixed streaks", () => {
    const entries: BaccaratHistoryEntry[] = [
      { winner: "player" },
      { winner: "player" },
      { winner: "banker" },
      { winner: "banker" },
      { winner: "banker" },
    ];
    const grid = computeBigRoad(entries);
    expect(gridTypes(grid)).toEqual([
      ["p", "b"],
      ["p", "b"],
      [".", "b"],
    ]);
  });

  test("dragon tail: streak > 6 overflows rightward", () => {
    const entries: BaccaratHistoryEntry[] = Array.from({ length: 8 }, () => ({ winner: "player" as const }));
    const grid = computeBigRoad(entries);
    expect(gridTypes(grid)).toEqual([
      ["p", ".", "."],
      ["p", ".", "."],
      ["p", ".", "."],
      ["p", ".", "."],
      ["p", ".", "."],
      ["p", "p", "p"],
    ]);
  });

  test("tie increments ties on last non-tie cell", () => {
    const entries: BaccaratHistoryEntry[] = [
      { winner: "player" },
      { winner: "tie" },
    ];
    const grid = computeBigRoad(entries);
    expect(gridTypes(grid)).toEqual([["p"]]);
    expect(gridTies(grid)).toEqual([[1]]);
  });

  test("multiple consecutive ties stack on same cell", () => {
    const entries: BaccaratHistoryEntry[] = [
      { winner: "banker" },
      { winner: "tie" },
      { winner: "tie" },
      { winner: "tie" },
    ];
    const grid = computeBigRoad(entries);
    expect(gridTypes(grid)).toEqual([["b"]]);
    expect(gridTies(grid)).toEqual([[3]]);
  });

  test("ties across column boundaries attach to correct cell", () => {
    const entries: BaccaratHistoryEntry[] = [
      { winner: "player" },
      { winner: "tie" },
      { winner: "banker" },
      { winner: "banker" },
      { winner: "tie" },
      { winner: "player" },
    ];
    const grid = computeBigRoad(entries);
    expect(gridTypes(grid)).toEqual([
      ["p", "b", "p"],
      [".", "b", "."],
    ]);
    expect(gridTies(grid)).toEqual([
      [1, 0, 0],
      [0, 1, 0],
    ]);
  });

  test("tie before any non-tie result is ignored", () => {
    const entries: BaccaratHistoryEntry[] = [
      { winner: "tie" },
      { winner: "player" },
    ];
    const grid = computeBigRoad(entries);
    expect(gridTypes(grid)).toEqual([["p"]]);
    expect(gridTies(grid)).toEqual([[0]]);
  });
});
