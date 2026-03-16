# Soft Hand Display & Casino-Like Deal Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the step-counter animation system with an event queue that deals cards lazily with casino-like pacing, and add dual-value soft hand display (e.g., `7/17`).

**Architecture:** A `GameEvent` queue drives all card animations through a single `useEffect`. Cards are dealt from the shoe lazily (on `dealFaceDown` events, not pre-dealt). A new `handDisplayValue()` engine function produces soft hand notation from visible cards only.

**Tech Stack:** React (Ink), TypeScript, Bun test runner

**Spec:** `docs/superpowers/specs/2026-03-16-soft-hand-display-and-casino-deal-flow-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/engine/blackjack.ts` | Modify | Add `handDisplayValue()` function |
| `src/engine/blackjack.test.ts` | Modify | Add tests for `handDisplayValue()` |
| `src/components/Blackjack.tsx` | Rewrite | Event queue system, lazy dealing, phase simplification, new rendering |
| `src/components/Card.tsx` | Modify | Update `HandDisplay` props to use `visibleSet` instead of `visibleCount` + `faceDownSet` |

---

## Chunk 1: Engine — handDisplayValue

### Task 1: Add `handDisplayValue()` with TDD

**Files:**
- Modify: `src/engine/blackjack.ts`
- Modify: `src/engine/blackjack.test.ts`

- [ ] **Step 1: Write failing tests for `handDisplayValue`**

Add to `src/engine/blackjack.test.ts`:

```typescript
import { handValue, handDisplayValue, isBlackjack, isBust, canFreeDouble, canSurrender, dealerShouldHit, resolveHand, calculatePayout } from "./blackjack";

// ... existing tests ...

describe("handDisplayValue", () => {
  test("empty hand returns empty string", () => {
    expect(handDisplayValue([])).toBe("");
  });
  test("single ace shows dual value", () => {
    expect(handDisplayValue([card("A")])).toBe("1/11");
  });
  test("ace + 6 shows soft 17", () => {
    expect(handDisplayValue([card("A"), card("6")])).toBe("7/17");
  });
  test("ace + 6 + 3 shows soft 20", () => {
    expect(handDisplayValue([card("A"), card("6"), card("3")])).toBe("10/20");
  });
  test("ace + 6 + 9 is hard 16 (ace forced to 1)", () => {
    expect(handDisplayValue([card("A"), card("6"), card("9")])).toBe("16");
  });
  test("ace + 5 + 7 is hard 13", () => {
    expect(handDisplayValue([card("A"), card("5"), card("7")])).toBe("13");
  });
  test("ace + 9 + 5 + 8 is bust 23", () => {
    expect(handDisplayValue([card("A"), card("9"), card("5"), card("8")])).toBe("23");
  });
  test("two aces show soft 12", () => {
    expect(handDisplayValue([card("A"), card("A")])).toBe("2/12");
  });
  test("two aces + 9 is 21 (both resolved)", () => {
    expect(handDisplayValue([card("A"), card("A"), card("9")])).toBe("21");
  });
  test("king + 7 shows hard 17", () => {
    expect(handDisplayValue([card("K"), card("7")])).toBe("17");
  });
  test("5 + 3 shows hard 8", () => {
    expect(handDisplayValue([card("5"), card("3")])).toBe("8");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/.claude/casino && bun test src/engine/blackjack.test.ts`
Expected: FAIL — `handDisplayValue` is not exported / doesn't exist

- [ ] **Step 3: Implement `handDisplayValue`**

Add to `src/engine/blackjack.ts` after the `handValue` function:

```typescript
export function handDisplayValue(cards: Card[]): string {
  if (cards.length === 0) return "";
  let total = cards.reduce((sum, c) => sum + cardPoints(c), 0);
  let aces = cards.filter((c) => c.value === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  // At 21, just show 21 — no need for dual notation
  if (total === 21) return "21";
  // If at least one ace is still counted as 11, show dual value
  if (aces > 0) {
    return `${total - 10}/${total}`;
  }
  return `${total}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/.claude/casino && bun test src/engine/blackjack.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd ~/.claude/casino
git add src/engine/blackjack.ts src/engine/blackjack.test.ts
git commit -m "feat: add handDisplayValue for soft hand dual notation (e.g. 7/17)"
```

---

## Chunk 2: Update HandDisplay component

### Task 2: Simplify `HandDisplay` props

The current `HandDisplay` takes `visibleCount` and `faceDownSet` — two overlapping concepts. Replace with a single `visibleSet: Set<number>` where cards in the hand but NOT in the set are face-down, and cards not yet dealt don't appear at all.

**Files:**
- Modify: `src/components/Card.tsx`

- [ ] **Step 1: Update `HandDisplay` props**

Replace the `HandDisplay` component in `src/components/Card.tsx`:

```typescript
export function HandDisplay({
  cards,
  visibleSet,
}: {
  cards: Card[];
  visibleSet?: Set<number>;
}) {
  const visible = visibleSet ?? new Set(cards.map((_, i) => i));

  return (
    <Box flexDirection="row">
      {cards.map((card, i) => (
        <Box key={i} marginRight={1}>
          <AsciiCard card={card} faceDown={!visible.has(i)} />
        </Box>
      ))}
    </Box>
  );
}
```

Note: No `visibleCount` needed — cards are only in the hand array after `dealFaceDown` adds them. All cards in the array are shown; the `visibleSet` controls face-up vs face-down.

- [ ] **Step 2: Verify existing code still compiles**

Run: `cd ~/.claude/casino && bunx tsc --noEmit`

This WILL fail because `Blackjack.tsx` still passes the old props. That's expected — we'll fix it in Task 3.

- [ ] **Step 3: Commit**

```bash
cd ~/.claude/casino
git add src/components/Card.tsx
git commit -m "refactor: simplify HandDisplay to use visibleSet instead of visibleCount + faceDownSet"
```

---

## Chunk 3: Rewrite Blackjack component with event queue

### Task 3: Replace animation system with event queue

This is the core rewrite. Replace all step-counter animation state and 4 separate `useEffect` timers with one event queue and one `useEffect`.

**Files:**
- Rewrite: `src/components/Blackjack.tsx`

- [ ] **Step 1: Define types and constants at top of file**

Replace the old `Phase` type and timing constants:

```typescript
type Phase = "betting" | "animating" | "insurance" | "playing" | "result";

const DEAL_DELAY = 200;    // card sliding onto table
const REVEAL_PAUSE = 2000; // tension moment before flip
const FLIP_DELAY = 250;    // card turning over

type EvaluateCallback = () => GameEvent[] | null;

type GameEvent =
  | { type: "dealFaceDown"; target: "player" | "dealer"; duration: typeof DEAL_DELAY }
  | { type: "pause"; duration: typeof REVEAL_PAUSE }
  | { type: "flip"; target: "player" | "dealer"; cardIndex: number; duration: typeof FLIP_DELAY }
  | { type: "updateValue"; target: "player" | "dealer"; duration: 0 }
  | { type: "evaluate"; callback: EvaluateCallback; duration: 0 }
  | { type: "setPhase"; phase: Phase; duration: 0 };
```

- [ ] **Step 2: Replace state variables**

Remove old animation state:
```typescript
// REMOVE these:
// const [dealStep, setDealStep] = useState(0);
// const [hitFaceDown, setHitFaceDown] = useState(false);
// const [dealerRevealStep, setDealerRevealStep] = useState(0);
// const [dealerMaxStep, setDealerMaxStep] = useState(0);
```

Add new state:
```typescript
const [eventQueue, setEventQueue] = useState<GameEvent[]>([]);
const [eventIndex, setEventIndex] = useState(0);
const [visibleCards, setVisibleCards] = useState<{ player: Set<number>; dealer: Set<number> }>({
  player: new Set(),
  dealer: new Set(),
});
```

- [ ] **Step 3: Add queue-builder helper functions**

These build event sequences for different game actions. They use mutable refs for the hands since `dealFaceDown` adds cards during animation.

```typescript
// Use refs so queue callbacks always see current state (avoids stale closures)
const playerHandRef = useRef<Card[]>([]);
const dealerHandRef = useRef<Card[]>([]);
const betRef = useRef(0);
const freeDoubledRef = useRef(false);
const doubledDownRef = useRef(false);
const doubledUpRef = useRef(false);

// Keep refs in sync on every render
playerHandRef.current = playerHand;
dealerHandRef.current = dealerHand;
betRef.current = bet;
freeDoubledRef.current = freeDoubled;
doubledDownRef.current = doubledDown;
doubledUpRef.current = doubledUp;

function buildDealQueue(): GameEvent[] {
  return [
    { type: "dealFaceDown", target: "player", duration: DEAL_DELAY },
    { type: "pause", duration: REVEAL_PAUSE },
    { type: "flip", target: "player", cardIndex: 0, duration: FLIP_DELAY },
    { type: "updateValue", target: "player", duration: 0 },
    { type: "dealFaceDown", target: "dealer", duration: DEAL_DELAY },
    { type: "pause", duration: REVEAL_PAUSE },
    { type: "flip", target: "dealer", cardIndex: 0, duration: FLIP_DELAY },
    { type: "updateValue", target: "dealer", duration: 0 },
    { type: "dealFaceDown", target: "player", duration: DEAL_DELAY },
    { type: "pause", duration: REVEAL_PAUSE },
    { type: "flip", target: "player", cardIndex: 1, duration: FLIP_DELAY },
    { type: "updateValue", target: "player", duration: 0 },
    { type: "dealFaceDown", target: "dealer", duration: DEAL_DELAY }, // hole card — no flip
    { type: "evaluate", callback: checkAfterDeal, duration: 0 },
  ];
}

function checkAfterDeal(): GameEvent[] | null {
  const dHand = dealerHandRef.current;
  const pHand = playerHandRef.current;
  if (canInsure(dHand[0])) {
    return [{ type: "setPhase", phase: "insurance", duration: 0 }];
  }
  if (isBlackjack(pHand) || isBlackjack(dHand)) {
    return [
      { type: "flip", target: "dealer", cardIndex: 1, duration: FLIP_DELAY },
      { type: "updateValue", target: "dealer", duration: 0 },
      { type: "evaluate", callback: resolveBlackjacks, duration: 0 },
    ];
  }
  return [{ type: "setPhase", phase: "playing", duration: 0 }];
}

function resolveBlackjacks(): GameEvent[] | null {
  const pHand = playerHandRef.current;
  const dHand = dealerHandRef.current;
  const pBJ = isBlackjack(pHand);
  const dBJ = isBlackjack(dHand);
  const r = resolveHand(handValue(pHand), handValue(dHand), pBJ, dBJ);
  const p = calculatePayout(betRef.current, r, false);
  const label = r === "blackjack" ? "BLACKJACK!" : r === "push" ? "Push" : "Dealer Blackjack";
  finishHand(label, p);
  return null;
}

function buildHitQueue(autoStand: boolean): GameEvent[] {
  const idx = playerHandRef.current.length; // will be correct at build time since we build right before animating
  return [
    { type: "dealFaceDown", target: "player", duration: DEAL_DELAY },
    { type: "pause", duration: REVEAL_PAUSE },
    { type: "flip", target: "player", cardIndex: idx, duration: FLIP_DELAY },
    { type: "updateValue", target: "player", duration: 0 },
    { type: "evaluate", callback: () => checkAfterPlayerCard(autoStand), duration: 0 },
  ];
}

function checkAfterPlayerCard(autoStand: boolean): GameEvent[] | null {
  const pHand = playerHandRef.current;
  const pVal = handValue(pHand);
  const currentBet = betRef.current;
  const isFreeDoubled = freeDoubledRef.current;
  const isDoubledDown = doubledDownRef.current;
  const isDoubledUp = doubledUpRef.current;
  const dUpAmt = isDoubledUp ? currentBet : 0;
  const effBet = (isDoubledDown ? currentBet * 2 : currentBet) + dUpAmt;
  if (pVal > 21) {
    finishHand("Bust!", calculatePayout(effBet, "bust", isFreeDoubled, dUpAmt));
    return null;
  }
  if (autoStand) {
    return buildDealerTurnQueue();
  }
  return [{ type: "setPhase", phase: "playing", duration: 0 }];
}

function buildDealerTurnQueue(): GameEvent[] {
  return [
    { type: "flip", target: "dealer", cardIndex: 1, duration: FLIP_DELAY },
    { type: "updateValue", target: "dealer", duration: 0 },
    { type: "evaluate", callback: dealerDecision, duration: 0 },
  ];
}

function dealerDecision(): GameEvent[] | null {
  const dHand = dealerHandRef.current;
  if (dealerShouldHit(dHand)) {
    const idx = dHand.length;
    return [
      { type: "dealFaceDown", target: "dealer", duration: DEAL_DELAY },
      { type: "pause", duration: REVEAL_PAUSE },
      { type: "flip", target: "dealer", cardIndex: idx, duration: FLIP_DELAY },
      { type: "updateValue", target: "dealer", duration: 0 },
      { type: "evaluate", callback: dealerDecision, duration: 0 },
    ];
  }
  // Dealer stands — resolve
  const pHand = playerHandRef.current;
  const currentBet = betRef.current;
  const isFreeDoubled = freeDoubledRef.current;
  const isDoubledDown = doubledDownRef.current;
  const isDoubledUp = doubledUpRef.current;
  const dUpAmt = isDoubledUp ? currentBet : 0;
  const effBet = (isDoubledDown ? currentBet * 2 : currentBet) + dUpAmt;
  const r = resolveHand(handValue(pHand), handValue(dHand), false, false);
  const p = calculatePayout(effBet, r, isFreeDoubled, dUpAmt);
  const label = r === "win" ? "You Win!" : r === "lose" ? "Dealer Wins" : r === "push22" ? "Push (22)" : "Push";
  finishHand(label, p);
  return null;
}
```

**Note on refs:** All evaluate callbacks read game state from refs (`betRef`, `freeDoubledRef`, etc.) instead of closing over React state. This avoids stale closure bugs — refs always reflect the latest committed state regardless of when the callback was created.

- [ ] **Step 4: Replace the 4 animation `useEffect`s with one**

Remove the `dealing`, `hitAnim`, `doubleDownAnim`, and `dealerTurn` useEffect blocks. Replace with:

```typescript
useEffect(() => {
  if (phase !== "animating") return;
  if (eventIndex >= eventQueue.length) return;

  const event = eventQueue[eventIndex];

  // Apply side effect immediately
  switch (event.type) {
    case "dealFaceDown": {
      const card = dealCard();
      if (event.target === "player") {
        setPlayerHand((prev) => [...prev, card]);
      } else {
        setDealerHand((prev) => [...prev, card]);
      }
      break;
    }
    case "flip": {
      setVisibleCards((prev) => {
        const next = { player: new Set(prev.player), dealer: new Set(prev.dealer) };
        next[event.target].add(event.cardIndex);
        return next;
      });
      break;
    }
    case "updateValue":
      // No-op — React re-renders from visibleCards change
      break;
    case "evaluate": {
      const newEvents = event.callback();
      if (newEvents === null) return; // Queue ends — callback called finishHand or similar
      if (newEvents.length > 0) {
        setEventQueue((prev) => [...prev, ...newEvents]);
      }
      // Fall through to advance index immediately (duration is 0)
      break;
    }
    case "setPhase": {
      setPhase(event.phase);
      return; // Don't advance — we're leaving animating phase
    }
  }

  // Schedule next event after duration
  if (event.duration > 0) {
    const timer = setTimeout(() => setEventIndex((i) => i + 1), event.duration);
    return () => clearTimeout(timer);
  } else {
    // Zero-duration events advance immediately
    setEventIndex((i) => i + 1);
  }
}, [phase, eventIndex, eventQueue, dealCard]);
```

- [ ] **Step 5: Rewrite `startHand` for lazy dealing**

```typescript
const startHand = useCallback((betAmount: number) => {
  setBet(betAmount);
  setLastBet(betAmount);
  setFreeDoubled(false);
  setDoubledDown(false);
  setDoubledUp(false);
  setInsuranceBet(0);
  setResult("");
  setPayout(0);

  // Reset hands and visibility — cards will be dealt lazily by the queue
  setPlayerHand([]);
  setDealerHand([]);
  setVisibleCards({ player: new Set(), dealer: new Set() });

  const queue = buildDealQueue();
  setEventQueue(queue);
  setEventIndex(0);
  setPhase("animating");
}, []);
```

- [ ] **Step 6: Rewrite player action handlers**

```typescript
const doHit = useCallback(() => {
  const queue = buildHitQueue(false);
  setEventQueue(queue);
  setEventIndex(0);
  setPhase("animating");
}, []);

const doStand = useCallback(() => {
  const queue = buildDealerTurnQueue();
  setEventQueue(queue);
  setEventIndex(0);
  setPhase("animating");
}, []);

const doFreeDouble = useCallback(() => {
  setFreeDoubled(true);
  const queue = buildHitQueue(true); // autoStand = true
  setEventQueue(queue);
  setEventIndex(0);
  setPhase("animating");
}, []);

const doDoubleDown = useCallback(() => {
  setDoubledDown(true);
  onUpdateBalance(-bet);
  const queue = buildHitQueue(true); // autoStand = true
  setEventQueue(queue);
  setEventIndex(0);
  setPhase("animating");
}, [bet, onUpdateBalance]);

const doDoubleUp = useCallback(() => {
  setDoubledUp(true);
  onUpdateBalance(-bet);
  const queue = buildDealerTurnQueue();
  setEventQueue(queue);
  setEventIndex(0);
  setPhase("animating");
}, [bet, onUpdateBalance]);
```

- [ ] **Step 7: Rewrite insurance handling**

Replace the `afterInsurance` callback. Instead of using `setTimeout`, build a new animation queue:

```typescript
const handleInsurance = useCallback((accepted: boolean) => {
  const currentBet = betRef.current;
  const ins = Math.floor(currentBet / 2);

  if (accepted) {
    setInsuranceBet(ins);
    onUpdateBalance(-ins); // Deduct insurance bet from balance
  }

  const pHand = playerHandRef.current;
  const dHand = dealerHandRef.current;
  const pBJ = isBlackjack(pHand);
  const dBJ = isBlackjack(dHand);

  if (pBJ || dBJ) {
    // Flip hole card first, then resolve
    const queue: GameEvent[] = [
      { type: "flip", target: "dealer", cardIndex: 1, duration: FLIP_DELAY },
      { type: "updateValue", target: "dealer", duration: 0 },
      { type: "evaluate", callback: () => {
        // Settle insurance side bet
        if (accepted) {
          // calculateInsurancePayout returns +2x if dealer BJ, -1x if not.
          // But we already deducted the insurance bet above, so:
          // - Dealer BJ: payout = ins * 2 (net profit = +ins)
          // - No dealer BJ: payout = -ins (but already deducted, so this is wrong)
          // The existing calculateInsurancePayout returns the NET change:
          //   dealerBJ ? ins * 2 : -ins
          // Since we already deducted ins, we need to add back ins then apply payout.
          // Simpler: just use the payout directly. ins was deducted, payout adjusts:
          //   dealerBJ: +ins*2 (net: -ins + ins*2 = +ins profit) ✓
          //   no dealerBJ: -ins (net: -ins + -ins = -2*ins) ✗ WRONG
          // Fix: if no BJ, payout should be 0 (loss was the deduction). If BJ, payout is +ins*2.
          const insPayout = dBJ ? ins * 2 : 0;
          onUpdateBalance(insPayout);
        }
        const r = resolveHand(handValue(pHand), handValue(dHand), pBJ, dBJ);
        const p = calculatePayout(currentBet, r, false);
        const label = r === "blackjack" ? "BLACKJACK!" : r === "push" ? "Push" : "Dealer Blackjack";
        finishHand(label, p);
        return null;
      }, duration: 0 },
    ];
    setEventQueue(queue);
    setEventIndex(0);
    setPhase("animating");
  } else {
    // No blackjack — insurance is lost (already deducted above), just play
    setPhase("playing");
  }
}, [onUpdateBalance, finishHand]);
```

Update `useInput` for insurance:
```typescript
if (phase === "insurance") {
  if (input === "y") handleInsurance(true);
  if (input === "n") handleInsurance(false);
}
```

- [ ] **Step 8: Update rendering to use `visibleCards` and `handDisplayValue`**

Update the import:
```typescript
import {
  handValue, handDisplayValue, isBlackjack, isBust, canFreeDouble, canSurrender,
  canInsure, calculateInsurancePayout, canDoubleDown,
  dealerShouldHit, resolveHand, calculatePayout,
} from "../engine/blackjack.js";
```

Add `useRef` to the React import:
```typescript
import React, { useState, useCallback, useEffect, useRef } from "react";
```

Replace the rendering helpers section. Remove `playerVisible()`, `playerFaceDown()`, `dealerVisible()`, `dealerFaceDown()` and the derived variables (`dFD`, `dVis`, `showDealerValue`, `pFD`, `showPlayerValue`).

Derive visible cards for display:
```typescript
const visiblePlayerCards = playerHand.filter((_, i) => visibleCards.player.has(i));
const visibleDealerCards = dealerHand.filter((_, i) => visibleCards.dealer.has(i));
const playerDisplayValue = handDisplayValue(visiblePlayerCards);
const dealerDisplayValue = handDisplayValue(visibleDealerCards);
```

Update the dealer hand display:
```html
<Box>
  <Text dimColor>Dealer </Text>
  {dealerDisplayValue && <Text dimColor>[{dealerDisplayValue}]</Text>}
</Box>
<HandDisplay cards={dealerHand} visibleSet={visibleCards.dealer} />
```

Update the player hand display:
```html
<Box>
  <Text dimColor>You </Text>
  {playerDisplayValue && <Text dimColor>[{playerDisplayValue}]</Text>}
  {canFreeDouble(playerHand) && phase === "playing" && (
    <Text color="yellow" bold>  FREE DOUBLE!</Text>
  )}
  {freeDoubled && <Text color="cyan"> (Free Doubled)</Text>}
  {doubledDown && <Text color="magenta"> (Doubled ${bet * 2})</Text>}
  {doubledUp && <Text color="green"> (Double Up)</Text>}
</Box>
<HandDisplay cards={playerHand} visibleSet={visibleCards.player} />
```

Update the animating phase text:
```html
{phase === "animating" && (
  <Text dimColor>Dealing...</Text>
)}
```

- [ ] **Step 9: Verify compilation**

Run: `cd ~/.claude/casino && bunx tsc --noEmit`
Expected: No type errors

- [ ] **Step 10: Manual smoke test**

Run: `cd ~/.claude/casino && bun run dev`

Verify:
1. Cards deal one at a time with ~2s pauses
2. Hand value only appears after card flips face-up
3. Soft hands show dual value (e.g., `1/11` for single Ace, `7/17` for A+6)
4. Hit works — card lands face-down, pause, flip, value updates
5. Stand works — hole card flips, dealer draws one at a time
6. Insurance flow works — hole card flips before blackjack resolution
7. Free double, double down, double up all work
8. Surrender bypasses animation

- [ ] **Step 11: Run all tests**

Run: `cd ~/.claude/casino && bun test`
Expected: All tests pass

- [ ] **Step 12: Commit**

```bash
cd ~/.claude/casino
git add src/components/Blackjack.tsx
git commit -m "feat: event queue animation system with casino-like pacing and soft hand display

Replace step-counter animation with event queue for natural card dealing.
Cards dealt lazily from shoe with 2s reveal pauses. Hand values only update
after cards flip face-up. Soft hands show dual notation (e.g. 7/17).
Dealer draws incrementally instead of batch pre-calculation."
```
