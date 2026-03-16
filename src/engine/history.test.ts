import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadHistory, saveHistory, addResult, type BaccaratHistoryEntry } from "./history";

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
