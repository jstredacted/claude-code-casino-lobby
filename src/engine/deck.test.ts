import { describe, test, expect } from "bun:test";
import { createShoe, deal, shouldReshuffle } from "./deck";

describe("createShoe", () => {
  test("creates 6-deck shoe with 312 cards", () => {
    const shoe = createShoe();
    expect(shoe.cards.length).toBe(312);
  });

  test("contains correct card distribution", () => {
    const shoe = createShoe();
    const aces = shoe.cards.filter((c) => c.value === "A");
    expect(aces.length).toBe(24);
  });
});

describe("deal", () => {
  test("removes card from top of shoe", () => {
    const shoe = createShoe();
    const card = deal(shoe);
    expect(card).toBeDefined();
    expect(shoe.cards.length).toBe(311);
  });
});

describe("shouldReshuffle", () => {
  test("returns false when shoe is fresh", () => {
    const shoe = createShoe();
    expect(shouldReshuffle(shoe)).toBe(false);
  });

  test("returns true when 75% dealt", () => {
    const shoe = createShoe();
    shoe.cards.splice(0, 234);
    expect(shouldReshuffle(shoe)).toBe(true);
  });
});
