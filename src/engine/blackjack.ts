import type { Card } from "./deck";

export function cardPoints(card: Card): number {
  if (card.value === "A") return 11;
  if (["K", "Q", "J"].includes(card.value)) return 10;
  return parseInt(card.value);
}

export function handValue(hand: Card[]): number {
  let total = hand.reduce((sum, c) => sum + cardPoints(c), 0);
  let aces = hand.filter((c) => c.value === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21;
}

export function isBust(hand: Card[]): boolean {
  return handValue(hand) > 21;
}

export function canFreeDouble(hand: Card[]): boolean {
  if (hand.length !== 2) return false;
  const val = handValue(hand);
  return val >= 9 && val <= 11;
}

export function canSurrender(hand: Card[]): boolean {
  return hand.length === 2;
}

export function canSplit(hand: Card[]): boolean {
  return hand.length === 2 && cardPoints(hand[0]) === cardPoints(hand[1]);
}

export function canInsure(dealerUpCard: Card): boolean {
  return dealerUpCard.value === "A";
}

export function calculateInsurancePayout(insuranceBet: number, dealerHasBlackjack: boolean): number {
  return dealerHasBlackjack ? insuranceBet * 2 : -insuranceBet;
}

export function canDoubleDown(hand: Card[], balance: number, bet: number): boolean {
  return hand.length === 2 && balance >= bet;
}

export function dealerShouldHit(hand: Card[]): boolean {
  return handValue(hand) < 17;
}

export type BlackjackResult = "blackjack" | "win" | "lose" | "push" | "push22" | "bust";

export function resolveHand(
  playerValue: number,
  dealerValue: number,
  playerBlackjack: boolean,
  dealerBlackjack: boolean,
): BlackjackResult {
  if (playerBlackjack && dealerBlackjack) return "push";
  if (playerBlackjack) return "blackjack";
  if (dealerBlackjack) return "lose";
  if (playerValue > 21) return "bust";
  if (dealerValue === 22) return "push22"; // dealer 22 is a push, not a dealer bust
  if (dealerValue > 21) return "win";
  if (playerValue > dealerValue) return "win";
  if (playerValue < dealerValue) return "lose";
  return "push";
}

export function calculatePayout(bet: number, result: BlackjackResult, isFreeDouble: boolean, doubleUpAmount: number = 0): number {
  switch (result) {
    case "blackjack": return bet * 1.5;
    case "win": return isFreeDouble ? bet * 2 : bet;
    case "push": return 0;
    case "push22": return doubleUpAmount > 0 ? -doubleUpAmount : 0; // lose double up, original bet returned
    case "lose":
    case "bust": return -bet;
  }
}
