import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { loadBankroll, saveBankroll, DEFAULT_BALANCE } from "./bankroll";
import { unlinkSync, existsSync } from "fs";

const TEST_PATH = "/tmp/casino-test-bankroll.json";

beforeEach(() => {
  if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH);
});

afterEach(() => {
  if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH);
});

describe("loadBankroll", () => {
  test("returns default when file missing", () => {
    const b = loadBankroll(TEST_PATH);
    expect(b.balance).toBe(DEFAULT_BALANCE);
    expect(b.hands_played).toBe(0);
  });

  test("loads existing file", () => {
    Bun.write(TEST_PATH, JSON.stringify({ balance: 500, hands_played: 10 }));
    const b = loadBankroll(TEST_PATH);
    expect(b.balance).toBe(500);
    expect(b.hands_played).toBe(10);
  });
});

describe("saveBankroll", () => {
  test("writes to file", async () => {
    saveBankroll({ balance: 750, hands_played: 5 }, TEST_PATH);
    const data = JSON.parse(await Bun.file(TEST_PATH).text());
    expect(data.balance).toBe(750);
  });

  test("resets balance if zero", async () => {
    saveBankroll({ balance: 0, hands_played: 20 }, TEST_PATH);
    const data = JSON.parse(await Bun.file(TEST_PATH).text());
    expect(data.balance).toBe(DEFAULT_BALANCE);
  });
});
