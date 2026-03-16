# Soft Hand Display & Casino-Like Deal Flow

## Problem

The Blackjack game reveals information too early, killing natural tension:
- Hand values show before all cards are visible
- All 4 initial cards are pre-dealt and animated in quick succession
- Declining insurance instantly resolves blackjack before the hole card flips
- Dealer draws are batch-calculated then fake-animated
- No indication of whether a hand is "soft" (Ace counted as 11)

## Solution

Two changes: (1) an event queue system that controls when cards appear and when values update, and (2) a dual-value display for soft hands.

## 1. Event Queue System

### Event Types

```typescript
type GameEvent =
  | { type: "dealFaceDown"; target: "player" | "dealer"; duration: 200 }
  | { type: "pause"; duration: 2000 }
  | { type: "flip"; target: "player" | "dealer"; cardIndex: number; duration: 250 }
  | { type: "updateValue"; target: "player" | "dealer"; duration: 0 }
  | { type: "evaluate"; callback: EvaluateCallback; duration: 0 }
  | { type: "setPhase"; phase: Phase; duration: 0 }
```

- `dealFaceDown` — deals a card from the shoe, appends it to the target's hand array, and renders it face-down. No `cardIndex` needed — always appends at `hand.length`.
- `pause` — the tension moment (~2 seconds)
- `flip` — adds card index to the `visibleCards` set, rendering it face-up
- `updateValue` — triggers re-render of hand value display (reads from `visibleCards`)
- `evaluate` — runs game logic synchronously, returns new events to append or null to end queue
- `setPhase` — transitions out of `animating` (e.g., to `insurance` or `playing`)

### Evaluate Callback Contract

```typescript
type EvaluateCallback = () => GameEvent[] | null;
```

- Must be **synchronous** — no setTimeout, no async. Returns events or null.
- `GameEvent[]` (including empty `[]`) — append to queue, continue processing
- `null` — queue ends, no further processing
- Use `setPhase` events to transition phases. Callbacks may call `finishHand()` to end the hand (which sets result/payout state and transitions to `result` phase) — this is the only exception to direct state setting, and works because React batches updates within the synchronous callback.
- Callback receives current state via closure at queue-build time. For dealer draw loops where state changes between evaluations, the callback reads from the mutable hand arrays (which are updated by prior `dealFaceDown` events in the same queue).

### Phase Simplification

```typescript
type Phase = "betting" | "animating" | "insurance" | "playing" | "result";
```

`animating` replaces `dealing`, `hitAnim`, `doubleDownAnim`, and `dealerTurn`. One `useEffect` drives the entire queue.

Game input is **ignored during `animating`** — `useInput` only processes game actions (hit, stand, etc.) when phase is `insurance`, `playing`, or `result`. The `betting` phase has its own input path via the `BetPicker` component and is unaffected by this change.

### State Changes

**Remove:** `dealStep`, `hitFaceDown`, `dealerRevealStep`, `dealerMaxStep`

**Add:**
- `eventQueue: GameEvent[]` — the sequence of animation events
- `currentEventIndex: number` — position in the queue (index-based iteration, events are not removed)
- `visibleCards: { player: Set<number>; dealer: Set<number> }` — which card indices are face-up

**Card dealing:** Cards are added to the hand array lazily by `dealFaceDown` events (dealt from shoe at that moment), NOT pre-dealt at start. `dealFaceDown` always appends to the target hand — no index needed.

### Initial Deal Queue

```
dealFaceDown(player, 0) → pause(2s) → flip(player, 0) → updateValue(player)
→ dealFaceDown(dealer, 0) → pause(2s) → flip(dealer, 0) → updateValue(dealer)
→ dealFaceDown(player, 1) → pause(2s) → flip(player, 1) → updateValue(player)
→ dealFaceDown(dealer, 1)  ← hole card, no flip, no pause
→ evaluate(checkInsuranceOrBlackjackOrPlay)
```

The `checkInsuranceOrBlackjackOrPlay` callback:
- If dealer up-card is Ace → return `[setPhase("insurance")]`
- If player or dealer has blackjack → return hole card flip + evaluate for resolution
- Otherwise → return `[setPhase("playing")]`

### Insurance Flow

When the player accepts or declines insurance, a new queue is built:

**Decline insurance (no blackjack):**
```
setPhase("playing")
```

**Decline insurance (blackjack exists):**
```
flip(dealer, 1) → updateValue(dealer) → evaluate(resolveBlackjack)
```

**Accept insurance:**
Same as decline, but insurance bet is deducted first and payout calculated during resolution.

The hole card always flips before any blackjack is resolved — fixing the premature-result bug.

### Dealer Draw — Truly Incremental

No batch pre-calculation. The `evaluate` event checks `dealerShouldHit()` on the current dealer hand. If yes, it returns:

```
dealFaceDown(dealer, N) → pause(2s) → flip(dealer, N) → updateValue(dealer) → evaluate(dealerDecision)
```

Each card is dealt from the shoe, revealed, then the dealer decides whether to draw again. When `dealerShouldHit()` returns false, the evaluate callback returns resolution events.

### Player Action Queues

**Hit:**
```
dealFaceDown(player, N) → pause(2s) → flip(player, N) → updateValue(player) → evaluate(checkBust)
```
`checkBust`: if bust → resolve. Otherwise → `setPhase("playing")`.

**Stand:**
```
flip(dealer, 1) → updateValue(dealer) → evaluate(dealerDecision)
```

**Free double:** Same queue as hit, but uses a `checkBustAndStand` callback that auto-stands on non-bust (proceeds to dealer turn instead of returning to `playing`). The callback closes over `freeDoubled=true` to calculate correct payout on bust.

**Double down:** Deduct extra bet, then same queue as hit, but uses `checkBustAndStand` callback that auto-stands on non-bust. The callback closes over `doubledDown=true` and uses `bet * 2` for payout calculation.

**Double up:** Deduct extra bet, no card drawn. Same queue as stand:
```
flip(dealer, 1) → updateValue(dealer) → evaluate(dealerDecision)
```

**Surrender:** No animation needed. Bypasses the queue entirely — directly calls `finishHand("Surrender", -bet * 0.5)` and sets phase to `result`.

### Timing Constants

```typescript
const DEAL_DELAY = 200;    // card sliding onto table
const REVEAL_PAUSE = 2000; // tension moment before flip
const FLIP_DELAY = 250;    // card turning over
```

### Animation Effect

Single `useEffect` watches `currentEventIndex` and `phase === "animating"`:
1. Read event at `currentEventIndex` from queue
2. Apply side effect (deal card from shoe into hand, add to visible set, etc.)
3. Set a timeout for the event's `duration`
4. On timeout, increment `currentEventIndex`
5. When index reaches end of queue, no further action (last event should be a `setPhase`)

For `evaluate` events: run the callback synchronously. If it returns events, append them to the queue via `setEventQueue(prev => [...prev, ...newEvents])`. If null, queue processing stops.

## 2. Dual Value Display

### New Engine Function

```typescript
function handDisplayValue(visibleCards: Card[]): string
```

Computes value only from face-up cards. Returns dual notation when soft:

| Visible Cards | Display |
|---|---|
| (none) | `""` |
| A | `1/11` |
| A, 6 | `7/17` |
| A, 6, 3 | `10/20` |
| A, 6, 9 | `16` |
| A, 5, 7 | `13` |
| A, 9, 5, 8 | `23` (bust) |
| A, A | `2/12` |
| A, A, 9 | `21` |
| K, 7 | `17` |

### Logic

- If no cards, return `""`
- Compute total with all Aces as 11
- Count Aces
- Demote Aces one at a time until total ≤ 21 or all Aces demoted
- If any Ace is still counted as 11 (demotion stopped before all Aces): return `{lowTotal}/{highTotal}` where lowTotal demotes that last Ace too
- If all Aces demoted or no Aces: return single total as string

### Rendering

Replace `[{handValue(playerHand)}]` with `[{handDisplayValue(visiblePlayerCards)}]`. The `visiblePlayerCards` are derived from `playerHand` filtered by `visibleCards.player` set.

Dealer value display follows the same rule — only face-up cards contribute.

## 3. Rendering Changes

### Removed Functions

`playerVisible()`, `playerFaceDown()`, `dealerVisible()`, `dealerFaceDown()` — all replaced by the `visibleCards` sets.

### HandDisplay Props

`HandDisplay` receives the `visibleCards` set. A card is face-down if its index exists in the hand array but is not in the visible set.

## Out of Scope

- **Split:** `canSplit()` exists in the engine but is not wired into the UI. Not addressed in this change.

## Files Changed

- `src/engine/blackjack.ts` — add `handDisplayValue()` function
- `src/engine/blackjack.test.ts` — tests for `handDisplayValue()` (empty hand, soft hands, hard hands, bust, multi-ace)
- `src/components/Blackjack.tsx` — event queue system, lazy card dealing, phase simplification, rendering changes
