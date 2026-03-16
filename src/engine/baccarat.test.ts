import { describe, test, expect } from "bun:test";
import { baccaratCardValue, baccaratHandTotal, playerDrawsThird, bankerDrawsThird, resolveBaccarat, calculateBaccaratPayout } from "./baccarat";
import type { Card } from "./deck";

const card = (value: string, suit = "♠"): Card => ({ value, suit } as Card);

describe("baccaratCardValue", () => {
  test("number cards at face value", () => {
    expect(baccaratCardValue(card("7"))).toBe(7);
  });
  test("face cards worth 0", () => {
    expect(baccaratCardValue(card("K"))).toBe(0);
    expect(baccaratCardValue(card("Q"))).toBe(0);
    expect(baccaratCardValue(card("J"))).toBe(0);
  });
  test("10 worth 0", () => {
    expect(baccaratCardValue(card("10"))).toBe(0);
  });
  test("ace worth 1", () => {
    expect(baccaratCardValue(card("A"))).toBe(1);
  });
});

describe("baccaratHandTotal", () => {
  test("takes ones digit only", () => {
    expect(baccaratHandTotal([card("7"), card("8")])).toBe(5);
  });
  test("natural 9", () => {
    expect(baccaratHandTotal([card("4"), card("5")])).toBe(9);
  });
});

describe("playerDrawsThird", () => {
  test("draws on 0-5", () => {
    expect(playerDrawsThird(5)).toBe(true);
    expect(playerDrawsThird(0)).toBe(true);
  });
  test("stands on 6-7", () => {
    expect(playerDrawsThird(6)).toBe(false);
    expect(playerDrawsThird(7)).toBe(false);
  });
});

describe("bankerDrawsThird", () => {
  test("always draws on 0-2", () => {
    expect(bankerDrawsThird(2, card("5"))).toBe(true);
  });
  test("banker 3 draws unless player third is 8", () => {
    expect(bankerDrawsThird(3, card("5"))).toBe(true);
    expect(bankerDrawsThird(3, card("8"))).toBe(false);
  });
  test("banker stands on 7", () => {
    expect(bankerDrawsThird(7, card("5"))).toBe(false);
  });
});

describe("resolveBaccarat", () => {
  test("player wins", () => {
    expect(resolveBaccarat(8, 5)).toBe("player");
  });
  test("banker wins", () => {
    expect(resolveBaccarat(3, 7)).toBe("banker");
  });
  test("tie", () => {
    expect(resolveBaccarat(6, 6)).toBe("tie");
  });
});

describe("calculateBaccaratPayout", () => {
  test("player bet wins pays 1:1", () => {
    expect(calculateBaccaratPayout(100, "player", "player")).toBe(100);
  });
  test("banker bet wins pays 1:1 (no commission)", () => {
    expect(calculateBaccaratPayout(100, "banker", "banker", 7)).toBe(100);
  });
  test("banker 6 win pays 50% winnings", () => {
    expect(calculateBaccaratPayout(100, "banker", "banker", 6)).toBe(50);
  });
  test("tie is a push — returns 0 regardless of bet side", () => {
    expect(calculateBaccaratPayout(100, "player", "tie")).toBe(0);
    expect(calculateBaccaratPayout(100, "banker", "tie")).toBe(0);
  });
  test("losing bet returns -bet", () => {
    expect(calculateBaccaratPayout(100, "player", "banker")).toBe(-100);
  });
});
