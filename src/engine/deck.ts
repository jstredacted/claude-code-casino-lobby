export type Suit = "♠" | "♥" | "♦" | "♣";
export type Value = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  value: Value;
  suit: Suit;
}

export interface Shoe {
  cards: Card[];
  totalCards: number;
}

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const VALUES: Value[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const NUM_DECKS = 6;
const RESHUFFLE_THRESHOLD = 0.75;

export function createShoe(): Shoe {
  const cards: Card[] = [];
  for (let d = 0; d < NUM_DECKS; d++) {
    for (const suit of SUITS) {
      for (const value of VALUES) {
        cards.push({ value, suit });
      }
    }
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { cards, totalCards: cards.length };
}

export function deal(shoe: Shoe): Card {
  const card = shoe.cards.pop();
  if (!card) throw new Error("Shoe is empty");
  return card;
}

export function shouldReshuffle(shoe: Shoe): boolean {
  const dealt = shoe.totalCards - shoe.cards.length;
  return dealt / shoe.totalCards >= RESHUFFLE_THRESHOLD;
}
