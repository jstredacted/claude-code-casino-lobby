import { describe, test, expect } from "bun:test";
import { handValue, isBlackjack, isBust, canFreeDouble, canSurrender, dealerShouldHit, resolveHand, calculatePayout } from "./blackjack";
import type { Card } from "./deck";

const card = (value: string, suit = "♠"): Card => ({ value, suit } as Card);

describe("handValue", () => {
  test("number cards at face value", () => {
    expect(handValue([card("5"), card("3")])).toBe(8);
  });
  test("face cards worth 10", () => {
    expect(handValue([card("K"), card("Q")])).toBe(20);
  });
  test("ace counts as 11 when safe", () => {
    expect(handValue([card("A"), card("9")])).toBe(20);
  });
  test("ace counts as 1 when 11 would bust", () => {
    expect(handValue([card("A"), card("9"), card("5")])).toBe(15);
  });
  test("multiple aces handled correctly", () => {
    expect(handValue([card("A"), card("A")])).toBe(12);
  });
});

describe("isBlackjack", () => {
  test("ace + face card is blackjack", () => {
    expect(isBlackjack([card("A"), card("K")])).toBe(true);
  });
  test("three cards totaling 21 is not blackjack", () => {
    expect(isBlackjack([card("7"), card("7"), card("7")])).toBe(false);
  });
});

describe("isBust", () => {
  test("over 21 is bust", () => {
    expect(isBust([card("K"), card("Q"), card("5")])).toBe(true);
  });
  test("21 is not bust", () => {
    expect(isBust([card("K"), card("Q"), card("A")])).toBe(false);
  });
});

describe("canFreeDouble", () => {
  test("true for hand value 9 with 2 cards", () => {
    expect(canFreeDouble([card("4"), card("5")])).toBe(true);
  });
  test("true for hand value 10 with 2 cards", () => {
    expect(canFreeDouble([card("4"), card("6")])).toBe(true);
  });
  test("true for hand value 11 with 2 cards", () => {
    expect(canFreeDouble([card("5"), card("6")])).toBe(true);
  });
  test("false for hand value 12", () => {
    expect(canFreeDouble([card("5"), card("7")])).toBe(false);
  });
  test("false for 3+ cards", () => {
    expect(canFreeDouble([card("2"), card("3"), card("4")])).toBe(false);
  });
});

describe("canSurrender", () => {
  test("true for initial 2-card hand", () => {
    expect(canSurrender([card("K"), card("6")])).toBe(true);
  });
  test("false after hitting", () => {
    expect(canSurrender([card("K"), card("3"), card("3")])).toBe(false);
  });
});

describe("dealerShouldHit", () => {
  test("dealer hits on 16", () => {
    expect(dealerShouldHit([card("K"), card("6")])).toBe(true);
  });
  test("dealer stands on hard 17", () => {
    expect(dealerShouldHit([card("K"), card("7")])).toBe(false);
  });
  test("dealer stands on soft 17", () => {
    expect(dealerShouldHit([card("A"), card("6")])).toBe(false);
  });
});

describe("resolveHand", () => {
  test("player blackjack beats dealer", () => {
    expect(resolveHand(21, 20, true, false)).toBe("blackjack");
  });
  test("both blackjack is push", () => {
    expect(resolveHand(21, 21, true, true)).toBe("push");
  });
  test("player 22 is bust", () => {
    expect(resolveHand(22, 18, false, false)).toBe("bust");
  });
  test("player bust over 22 loses", () => {
    expect(resolveHand(23, 18, false, false)).toBe("bust");
  });
  test("dealer 22 is push22", () => {
    expect(resolveHand(18, 22, false, false)).toBe("push22");
  });
  test("dealer bust over 22 player wins", () => {
    expect(resolveHand(18, 23, false, false)).toBe("win");
  });
  test("equal values is push", () => {
    expect(resolveHand(18, 18, false, false)).toBe("push");
  });
});

describe("calculatePayout", () => {
  test("blackjack pays 3:2", () => {
    expect(calculatePayout(100, "blackjack", false)).toBe(150);
  });
  test("normal win pays 1:1", () => {
    expect(calculatePayout(100, "win", false)).toBe(100);
  });
  test("free double win pays 2:1", () => {
    expect(calculatePayout(100, "win", true)).toBe(200);
  });
  test("push returns 0", () => {
    expect(calculatePayout(100, "push", false)).toBe(0);
  });
  test("loss returns -bet", () => {
    expect(calculatePayout(100, "lose", false)).toBe(-100);
  });
  test("push22 returns 0 without double up", () => {
    expect(calculatePayout(100, "push22", false, 0)).toBe(0);
  });
  test("push22 loses double up amount only", () => {
    expect(calculatePayout(200, "push22", false, 100)).toBe(-100);
  });
});
