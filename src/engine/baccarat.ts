import type { Card } from "./deck";

export function baccaratCardValue(card: Card): number {
  if (card.value === "A") return 1;
  if (["K", "Q", "J", "10"].includes(card.value)) return 0;
  return parseInt(card.value);
}

export function baccaratHandTotal(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + baccaratCardValue(c), 0) % 10;
}

export function isNatural(total: number): boolean {
  return total === 8 || total === 9;
}

export function playerDrawsThird(playerTotal: number): boolean {
  return playerTotal <= 5;
}

export function bankerDrawsThird(bankerTotal: number, playerThirdCard: Card): boolean {
  const p = baccaratCardValue(playerThirdCard);
  if (bankerTotal <= 2) return true;
  if (bankerTotal === 3) return p !== 8;
  if (bankerTotal === 4) return p >= 2 && p <= 7;
  if (bankerTotal === 5) return p >= 4 && p <= 7;
  if (bankerTotal === 6) return p === 6 || p === 7;
  return false;
}

export type BaccaratBet = "player" | "banker" | "tie";
export type BaccaratResult = "player" | "banker" | "tie";

export function resolveBaccarat(playerTotal: number, bankerTotal: number): BaccaratResult {
  if (playerTotal > bankerTotal) return "player";
  if (bankerTotal > playerTotal) return "banker";
  return "tie";
}

export function calculateBaccaratPayout(bet: number, betOn: BaccaratBet, result: BaccaratResult): number {
  if (betOn === result) {
    if (result === "player") return bet;
    if (result === "banker") return bet * 0.95;
    if (result === "tie") return bet * 8;
  }
  return -bet;
}
