import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { HandDisplay } from "./Card.js";
import { ChipBar } from "./ChipBar.js";
import { BetPicker } from "./BetPicker.js";
import { createShoe, deal, shouldReshuffle, type Shoe, type Card } from "../engine/deck.js";
import {
  handValue, handDisplayValue, isBlackjack, isBust, canFreeDouble, canSurrender,
  canInsure, canDoubleDown,
  dealerShouldHit, resolveHand, calculatePayout,
} from "../engine/blackjack.js";
import { loadSettings, saveSettings } from "../settings.js";

type Phase = "betting" | "animating" | "insurance" | "playing" | "result";

const DEAL_DELAY = 200;
const REVEAL_PAUSE = 2000;
const FLIP_DELAY = 250;

type EvaluateCallback = () => GameEvent[] | null;

type GameEvent =
  | { type: "dealFaceDown"; target: "player" | "dealer"; duration: typeof DEAL_DELAY }
  | { type: "pause"; duration: typeof REVEAL_PAUSE }
  | { type: "flip"; target: "player" | "dealer"; cardIndex: number; duration: typeof FLIP_DELAY }
  | { type: "updateValue"; target: "player" | "dealer"; duration: 0 }
  | { type: "evaluate"; callback: EvaluateCallback; duration: 0 }
  | { type: "setPhase"; phase: Phase; duration: 0 };

interface BlackjackProps {
  balance: number;
  onUpdateBalance: (delta: number) => void;
  onQuit: () => void;
}

export function Blackjack({ balance, onUpdateBalance, onQuit }: BlackjackProps) {
  const [shoe] = useState<Shoe>(() => createShoe());
  const [phase, setPhase] = useState<Phase>("betting");
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [bet, setBet] = useState(0);
  const [lastBet, setLastBet] = useState<number | undefined>();
  const [freeDoubled, setFreeDoubled] = useState(false);
  const [doubledDown, setDoubledDown] = useState(false);
  const [doubledUp, setDoubledUp] = useState(false);
  const [insuranceBet, setInsuranceBet] = useState(0);
  const [result, setResult] = useState("");
  const [payout, setPayout] = useState(0);
  const [chips, setChips] = useState(() => loadSettings().chips);

  // Event queue state
  const [eventQueue, setEventQueue] = useState<GameEvent[]>([]);
  const [eventIndex, setEventIndex] = useState(0);
  const [visibleCards, setVisibleCards] = useState<{ player: Set<number>; dealer: Set<number> }>({
    player: new Set(),
    dealer: new Set(),
  });

  // Refs for stale closure avoidance
  const playerHandRef = useRef<Card[]>([]);
  const dealerHandRef = useRef<Card[]>([]);
  const betRef = useRef(0);
  const freeDoubledRef = useRef(false);
  const doubledDownRef = useRef(false);
  const doubledUpRef = useRef(false);

  // Sync refs on every render
  playerHandRef.current = playerHand;
  dealerHandRef.current = dealerHand;
  betRef.current = bet;
  freeDoubledRef.current = freeDoubled;
  doubledDownRef.current = doubledDown;
  doubledUpRef.current = doubledUp;

  const dealCard = useCallback((): Card => {
    if (shouldReshuffle(shoe)) {
      const newShoe = createShoe();
      shoe.cards = newShoe.cards;
      shoe.totalCards = newShoe.totalCards;
    }
    return deal(shoe);
  }, [shoe]);

  const finishHand = useCallback((r: string, p: number) => {
    setResult(r);
    setPayout(p);
    onUpdateBalance(p);
    setPhase("result");
  }, [onUpdateBalance]);

  // --- Queue builder functions ---

  const resolveBlackjacks = useCallback((): GameEvent[] | null => {
    const pHand = playerHandRef.current;
    const dHand = dealerHandRef.current;
    const currentBet = betRef.current;
    const pBJ = isBlackjack(pHand);
    const dBJ = isBlackjack(dHand);
    const r = resolveHand(handValue(pHand), handValue(dHand), pBJ, dBJ);
    const p = calculatePayout(currentBet, r, false);
    const label = r === "blackjack" ? "BLACKJACK!" : r === "push" ? "Push" : "Dealer Blackjack";
    finishHand(label, p);
    return null;
  }, [finishHand]);

  const dealerDecision = useCallback((): GameEvent[] | null => {
    const dHand = dealerHandRef.current;
    if (dealerShouldHit(dHand)) {
      const nextIdx = dHand.length;
      return [
        { type: "dealFaceDown", target: "dealer", duration: DEAL_DELAY },
        { type: "pause", duration: REVEAL_PAUSE },
        { type: "flip", target: "dealer", cardIndex: nextIdx, duration: FLIP_DELAY },
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
  }, [finishHand]);

  const buildDealerTurnQueue = useCallback((): GameEvent[] => {
    // Flip hole card (dealer index 1), then evaluate dealer decision
    return [
      { type: "flip", target: "dealer", cardIndex: 1, duration: FLIP_DELAY },
      { type: "updateValue", target: "dealer", duration: 0 },
      { type: "evaluate", callback: dealerDecision, duration: 0 },
    ];
  }, [dealerDecision]);

  const checkAfterPlayerCard = useCallback((autoStand: boolean): EvaluateCallback => {
    return () => {
      const pHand = playerHandRef.current;
      const pVal = handValue(pHand);
      if (pVal > 21) {
        const currentBet = betRef.current;
        const isFreeDoubled = freeDoubledRef.current;
        const isDoubledDown = doubledDownRef.current;
        const isDoubledUp = doubledUpRef.current;
        const dUpAmt = isDoubledUp ? currentBet : 0;
        const effBet = (isDoubledDown ? currentBet * 2 : currentBet) + dUpAmt;
        finishHand("Bust!", calculatePayout(effBet, "bust", isFreeDoubled, dUpAmt));
        return null;
      }
      if (autoStand) {
        return buildDealerTurnQueue();
      }
      return [{ type: "setPhase", phase: "playing" as Phase, duration: 0 }];
    };
  }, [finishHand, buildDealerTurnQueue]);

  const buildHitQueue = useCallback((autoStand: boolean): GameEvent[] => {
    const nextIdx = playerHandRef.current.length;
    return [
      { type: "dealFaceDown", target: "player", duration: DEAL_DELAY },
      { type: "pause", duration: REVEAL_PAUSE },
      { type: "flip", target: "player", cardIndex: nextIdx, duration: FLIP_DELAY },
      { type: "updateValue", target: "player", duration: 0 },
      { type: "evaluate", callback: checkAfterPlayerCard(autoStand), duration: 0 },
    ];
  }, [checkAfterPlayerCard]);

  const checkAfterDeal = useCallback((): GameEvent[] | null => {
    const pHand = playerHandRef.current;
    const dHand = dealerHandRef.current;

    if (canInsure(dHand[0])) {
      return [{ type: "setPhase", phase: "insurance" as Phase, duration: 0 }];
    }

    const pBJ = isBlackjack(pHand);
    const dBJ = isBlackjack(dHand);
    if (pBJ || dBJ) {
      return [
        { type: "flip", target: "dealer", cardIndex: 1, duration: FLIP_DELAY },
        { type: "updateValue", target: "dealer", duration: 0 },
        { type: "evaluate", callback: resolveBlackjacks, duration: 0 },
      ];
    }

    return [{ type: "setPhase", phase: "playing" as Phase, duration: 0 }];
  }, [resolveBlackjacks]);

  const buildDealQueue = useCallback((): GameEvent[] => {
    return [
      // Player card 0
      { type: "dealFaceDown", target: "player", duration: DEAL_DELAY },
      { type: "pause", duration: REVEAL_PAUSE },
      { type: "flip", target: "player", cardIndex: 0, duration: FLIP_DELAY },
      { type: "updateValue", target: "player", duration: 0 },
      // Dealer card 0
      { type: "dealFaceDown", target: "dealer", duration: DEAL_DELAY },
      { type: "pause", duration: REVEAL_PAUSE },
      { type: "flip", target: "dealer", cardIndex: 0, duration: FLIP_DELAY },
      { type: "updateValue", target: "dealer", duration: 0 },
      // Player card 1
      { type: "dealFaceDown", target: "player", duration: DEAL_DELAY },
      { type: "pause", duration: REVEAL_PAUSE },
      { type: "flip", target: "player", cardIndex: 1, duration: FLIP_DELAY },
      { type: "updateValue", target: "player", duration: 0 },
      // Dealer hole card (no flip)
      { type: "dealFaceDown", target: "dealer", duration: DEAL_DELAY },
      // Evaluate after deal
      { type: "evaluate", callback: checkAfterDeal, duration: 0 },
    ];
  }, [checkAfterDeal]);

  // --- Single animation useEffect ---
  useEffect(() => {
    if (phase !== "animating") return;
    if (eventIndex >= eventQueue.length) return;

    const event = eventQueue[eventIndex];

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
      case "pause":
        break; // Just wait for the duration
      case "flip": {
        setVisibleCards((prev) => {
          const next = { player: new Set(prev.player), dealer: new Set(prev.dealer) };
          next[event.target].add(event.cardIndex);
          return next;
        });
        break;
      }
      case "updateValue":
        break; // No-op — React re-renders from visibleCards change
      case "evaluate": {
        const newEvents = event.callback();
        if (newEvents === null) return;
        if (newEvents.length > 0) {
          setEventQueue((prev) => [...prev, ...newEvents]);
        }
        break;
      }
      case "setPhase": {
        setPhase(event.phase);
        return; // Don't advance
      }
    }

    if (event.duration > 0) {
      const timer = setTimeout(() => setEventIndex((i) => i + 1), event.duration);
      return () => clearTimeout(timer);
    } else {
      setEventIndex((i) => i + 1);
    }
  }, [phase, eventIndex, eventQueue, dealCard]);

  // --- Action handlers ---

  const startHand = useCallback((betAmount: number) => {
    setBet(betAmount);
    setLastBet(betAmount);
    setFreeDoubled(false);
    setDoubledDown(false);
    setDoubledUp(false);
    setInsuranceBet(0);
    setResult("");
    setPayout(0);
    setPlayerHand([]);
    setDealerHand([]);
    setVisibleCards({ player: new Set(), dealer: new Set() });

    const queue = buildDealQueue();
    setEventQueue(queue);
    setEventIndex(0);
    setPhase("animating");
  }, [buildDealQueue]);

  const doHit = useCallback(() => {
    const queue = buildHitQueue(false);
    setEventQueue(queue);
    setEventIndex(0);
    setPhase("animating");
  }, [buildHitQueue]);

  const doStand = useCallback(() => {
    const queue = buildDealerTurnQueue();
    setEventQueue(queue);
    setEventIndex(0);
    setPhase("animating");
  }, [buildDealerTurnQueue]);

  const doFreeDouble = useCallback(() => {
    setFreeDoubled(true);
    const queue = buildHitQueue(true);
    setEventQueue(queue);
    setEventIndex(0);
    setPhase("animating");
  }, [buildHitQueue]);

  const doDoubleDown = useCallback(() => {
    setDoubledDown(true);
    onUpdateBalance(-bet);
    const queue = buildHitQueue(true);
    setEventQueue(queue);
    setEventIndex(0);
    setPhase("animating");
  }, [buildHitQueue, bet, onUpdateBalance]);

  const doDoubleUp = useCallback(() => {
    setDoubledUp(true);
    onUpdateBalance(-bet);
    const queue = buildDealerTurnQueue();
    setEventQueue(queue);
    setEventIndex(0);
    setPhase("animating");
  }, [buildDealerTurnQueue, bet, onUpdateBalance]);

  // --- Insurance handling ---

  const handleInsurance = useCallback((accepted: boolean) => {
    const currentBet = betRef.current;
    const ins = Math.floor(currentBet / 2);

    if (accepted) {
      setInsuranceBet(ins);
      onUpdateBalance(-ins);
    }

    const pHand = playerHandRef.current;
    const dHand = dealerHandRef.current;
    const pBJ = isBlackjack(pHand);
    const dBJ = isBlackjack(dHand);

    if (pBJ || dBJ) {
      const queue: GameEvent[] = [
        { type: "flip", target: "dealer", cardIndex: 1, duration: FLIP_DELAY },
        { type: "updateValue", target: "dealer", duration: 0 },
        { type: "evaluate", callback: () => {
          if (accepted) {
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
      setPhase("playing");
    }
  }, [onUpdateBalance, finishHand]);

  // --- Input handling ---

  useInput((input, key) => {
    if (phase === "insurance") {
      if (input === "y") handleInsurance(true);
      if (input === "n") handleInsurance(false);
    }
    if (phase === "playing") {
      const noDoubleYet = !freeDoubled && !doubledDown && !doubledUp;
      if (input === "h" && noDoubleYet) doHit();
      if (input === "s" && noDoubleYet) doStand();
      if (input === "d" && noDoubleYet && canFreeDouble(playerHand)) doFreeDouble();
      if (input === "x" && noDoubleYet && canDoubleDown(playerHand, balance - bet, bet)) doDoubleDown();
      if (input === "u" && noDoubleYet && playerHand.length === 2 && balance - bet >= bet) doDoubleUp();
      if (input === "r" && noDoubleYet && canSurrender(playerHand)) finishHand("Surrender", -bet * 0.5);
      if (input === "q") onQuit();
    }
    if (phase === "result") {
      if (key.return) setPhase("betting");
      if (input === "q") onQuit();
    }
  });

  // --- Derived display values ---

  const visiblePlayerCards = playerHand.filter((_, i) => visibleCards.player.has(i));
  const visibleDealerCards = dealerHand.filter((_, i) => visibleCards.dealer.has(i));
  const playerDisplayValue = handDisplayValue(visiblePlayerCards);
  const dealerDisplayValue = handDisplayValue(visibleDealerCards);

  const doubleUpAmount = doubledUp ? bet : 0;
  const effectiveBet = (doubledDown ? bet * 2 : bet) + doubleUpAmount;

  // --- Betting screen ---
  if (phase === "betting") {
    return (
      <Box flexDirection="column">
        <Box justifyContent="space-between">
          <Text bold color="cyan">FREE DOUBLE BLACKJACK</Text>
          <Text color="green" bold>${balance.toLocaleString()}</Text>
        </Box>
        <Box marginTop={1} justifyContent="center">
          <BetPicker balance={balance} lastBet={lastBet} chips={chips} onChipsChange={(newChips) => { setChips(newChips); saveSettings({ ...loadSettings(), chips: newChips }); }} onConfirm={startHand} onQuit={onQuit} />
        </Box>
      </Box>
    );
  }

  // --- Game screen ---
  return (
    <Box flexDirection="column">
      <ChipBar balance={balance} bet={effectiveBet} />
      <Text bold color="yellow">{"\u2500".repeat(44)}</Text>

      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text dimColor>Dealer </Text>
          {dealerDisplayValue && <Text dimColor>[{dealerDisplayValue}]</Text>}
        </Box>
        <HandDisplay
          cards={dealerHand}
          visibleSet={visibleCards.dealer}
        />
      </Box>

      <Box marginTop={1} flexDirection="column">
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
        <HandDisplay
          cards={playerHand}
          visibleSet={visibleCards.player}
        />
      </Box>

      <Box marginTop={1}>
        {phase === "insurance" && (
          <Box flexDirection="column">
            <Text bold color="yellow">Dealer shows Ace — Insurance?</Text>
            <Text>
              <Text bold color="green">[Y]</Text><Text>es (${Math.floor(bet / 2)})  </Text>
              <Text bold color="red">[N]</Text><Text>o thanks</Text>
            </Text>
          </Box>
        )}
        {phase === "playing" && (
          <Text>
            <Text bold>[H]</Text><Text>it  </Text>
            <Text bold>[S]</Text><Text>tand  </Text>
            {canFreeDouble(playerHand) && (
              <><Text bold color="yellow">[D]</Text><Text color="yellow">ouble  </Text></>
            )}
            {canDoubleDown(playerHand, balance - bet, bet) && !canFreeDouble(playerHand) && (
              <><Text bold color="magenta">[X]</Text><Text color="magenta"> Double (${bet})  </Text></>
            )}
            {canFreeDouble(playerHand) && canDoubleDown(playerHand, balance - bet, bet) && (
              <><Text bold color="magenta">[X]</Text><Text color="magenta"> Paid Double (${bet})  </Text></>
            )}
            {playerHand.length === 2 && balance - bet >= bet && (
              <><Text bold color="green">[U]</Text><Text color="green"> Double Up (${bet})  </Text></>
            )}
            {canSurrender(playerHand) && (
              <><Text bold>[R]</Text><Text>esign  </Text></>
            )}
            <Text bold>[Q]</Text><Text>uit</Text>
          </Text>
        )}
        {phase === "animating" && (
          <Text dimColor>Dealing...</Text>
        )}
        {phase === "result" && (
          <Box flexDirection="column">
            <Text bold color={payout > 0 ? "green" : payout < 0 ? "red" : "yellow"}>
              {result} {payout > 0 ? `+$${payout}` : payout < 0 ? `-$${Math.abs(payout)}` : ""}
              {insuranceBet > 0 && (
                <Text dimColor>  (ins: {isBlackjack(dealerHand) ? `+$${insuranceBet * 2}` : `-$${insuranceBet}`})</Text>
              )}
            </Text>
            <Text dimColor>Enter: Next hand  q: Back to lobby</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
