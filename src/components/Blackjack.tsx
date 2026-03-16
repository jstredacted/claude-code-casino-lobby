import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { HandDisplay } from "./Card.js";
import { ChipBar } from "./ChipBar.js";
import { BetPicker } from "./BetPicker.js";
import { createShoe, deal, shouldReshuffle, type Shoe, type Card } from "../engine/deck.js";
import {
  handValue, isBlackjack, isBust, canFreeDouble, canSurrender,
  canInsure, calculateInsurancePayout, canDoubleDown,
  dealerShouldHit, resolveHand, calculatePayout,
} from "../engine/blackjack.js";

/*
 * Deal animation steps (initial deal):
 *   1: player[0] face-down    2: player[0] flip
 *   3: dealer[0] face-down    4: dealer[0] flip
 *   5: player[1] face-down    6: player[1] flip
 *   7: dealer[1] face-down    (stays face-down = hole card)
 *   8: dealing done
 *
 * Hit animation: new card appears face-down, flips after delay
 * Dealer turn: hole card flips, then each draw animates
 */

type Phase = "betting" | "dealing" | "insurance" | "playing" | "hitAnim" | "dealerTurn" | "doubleDownAnim" | "result";

const DEAL_DELAY = 200;
const FLIP_DELAY = 250;

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

  // Animation state
  const [dealStep, setDealStep] = useState(0);
  const [hitFaceDown, setHitFaceDown] = useState(false);
  const [dealerRevealStep, setDealerRevealStep] = useState(0);
  const [dealerMaxStep, setDealerMaxStep] = useState(0);

  const dealCard = useCallback((): Card => {
    if (shouldReshuffle(shoe)) {
      const newShoe = createShoe();
      shoe.cards = newShoe.cards;
      shoe.totalCards = newShoe.totalCards;
    }
    return deal(shoe);
  }, [shoe]);

  const doubleUpAmount = doubledUp ? bet : 0;
  const effectiveBet = (doubledDown ? bet * 2 : bet) + doubleUpAmount;

  const finishHand = useCallback((r: string, p: number) => {
    setResult(r);
    setPayout(p);
    onUpdateBalance(p);
    setPhase("result");
  }, [onUpdateBalance]);

  // After insurance decision, check blackjacks and proceed
  const afterInsurance = useCallback(() => {
    const dealerBJ = isBlackjack(dealerHand);
    const playerBJ = isBlackjack(playerHand);

    // Settle insurance side bet
    if (insuranceBet > 0) {
      const insPayout = calculateInsurancePayout(insuranceBet, dealerBJ);
      onUpdateBalance(insPayout);
    }

    if (playerBJ || dealerBJ) {
      const r = resolveHand(
        handValue(playerHand), handValue(dealerHand),
        playerBJ, dealerBJ,
      );
      const p = calculatePayout(bet, r, false);
      const label = r === "blackjack" ? "BLACKJACK!" : r === "push" ? "Push" : "Dealer Blackjack";
      finishHand(label, p);
    } else {
      setPhase("playing");
    }
  }, [playerHand, dealerHand, bet, insuranceBet, onUpdateBalance, finishHand]);

  // --- Deal animation timer ---
  useEffect(() => {
    if (phase !== "dealing") return;
    if (dealStep >= 8) {
      // Animation done — check for insurance first
      if (canInsure(dealerHand[0])) {
        setPhase("insurance");
      } else {
        // No insurance needed, check blackjack directly
        if (isBlackjack(playerHand) || isBlackjack(dealerHand)) {
          const r = resolveHand(
            handValue(playerHand), handValue(dealerHand),
            isBlackjack(playerHand), isBlackjack(dealerHand),
          );
          const p = calculatePayout(bet, r, false);
          const label = r === "blackjack" ? "BLACKJACK!" : r === "push" ? "Push" : "Dealer Blackjack";
          finishHand(label, p);
        } else {
          setPhase("playing");
        }
      }
      return;
    }

    const isFlip = dealStep % 2 === 0 && dealStep > 0;
    const delay = isFlip ? FLIP_DELAY : DEAL_DELAY;
    const timer = setTimeout(() => setDealStep((s) => s + 1), delay);
    return () => clearTimeout(timer);
  }, [phase, dealStep, playerHand, dealerHand, bet, finishHand]);

  // --- Hit animation timer ---
  useEffect(() => {
    if (phase !== "hitAnim") return;
    const timer = setTimeout(() => {
      setHitFaceDown(false);
      const pVal = handValue(playerHand);
      if (pVal === 22) {
        finishHand("Push (22)", calculatePayout(effectiveBet, "push22", freeDoubled, doubleUpAmount));
      } else if (pVal > 21) {
        finishHand("Bust!", calculatePayout(effectiveBet, "bust", freeDoubled, doubleUpAmount));
      } else if (freeDoubled || doubledUp) {
        // Free double and double up are one-card actions — auto-stand
        const newDealerHand = [...dealerHand];
        while (dealerShouldHit(newDealerHand)) {
          newDealerHand.push(dealCard());
        }
        setDealerHand(newDealerHand);
        const extraCards = newDealerHand.length - 2;
        const steps = 1 + extraCards * 2;
        setDealerRevealStep(0);
        setDealerMaxStep(steps);
        setPhase("dealerTurn");
      } else {
        setPhase("playing");
      }
    }, FLIP_DELAY);
    return () => clearTimeout(timer);
  }, [phase, playerHand, dealerHand, effectiveBet, freeDoubled, doubledUp, doubleUpAmount, dealCard, finishHand]);

  // --- Double down animation timer ---
  useEffect(() => {
    if (phase !== "doubleDownAnim") return;
    const timer = setTimeout(() => {
      setHitFaceDown(false);
      const pVal = handValue(playerHand);
      if (pVal === 22) {
        finishHand("Push (22)", calculatePayout(bet * 2 + doubleUpAmount, "push22", false, doubleUpAmount));
      } else if (pVal > 21) {
        finishHand("Bust!", calculatePayout(bet * 2 + doubleUpAmount, "bust", false, doubleUpAmount));
      } else {
        // Auto-stand after double down
        const newDealerHand = [...dealerHand];
        while (dealerShouldHit(newDealerHand)) {
          newDealerHand.push(dealCard());
        }
        setDealerHand(newDealerHand);
        const extraCards = newDealerHand.length - 2;
        const steps = 1 + extraCards * 2;
        setDealerRevealStep(0);
        setDealerMaxStep(steps);
        setPhase("dealerTurn");
      }
    }, FLIP_DELAY);
    return () => clearTimeout(timer);
  }, [phase, playerHand, dealerHand, bet, dealCard, finishHand]);

  // --- Dealer turn animation timer ---
  useEffect(() => {
    if (phase !== "dealerTurn") return;
    if (dealerRevealStep >= dealerMaxStep) {
      const r = resolveHand(handValue(playerHand), handValue(dealerHand), false, false);
      const p = calculatePayout(effectiveBet, r, freeDoubled, doubleUpAmount);
      const label = r === "win" ? "You Win!" : r === "lose" ? "Dealer Wins" : r === "push22" ? "Push (22)" : "Push";
      finishHand(label, p);
      return;
    }

    const isFlip = dealerRevealStep % 2 === 0 && dealerRevealStep > 0;
    const delay = isFlip ? FLIP_DELAY : DEAL_DELAY;
    const timer = setTimeout(() => setDealerRevealStep((s) => s + 1), delay);
    return () => clearTimeout(timer);
  }, [phase, dealerRevealStep, dealerMaxStep, playerHand, dealerHand, effectiveBet, freeDoubled, finishHand]);

  // --- Actions ---
  const startHand = useCallback((betAmount: number) => {
    setBet(betAmount);
    setLastBet(betAmount);
    setFreeDoubled(false);
    setDoubledDown(false);
    setDoubledUp(false);
    setInsuranceBet(0);
    setResult("");
    setPayout(0);
    setDealStep(0);
    setHitFaceDown(false);

    const p1 = dealCard();
    const d1 = dealCard();
    const p2 = dealCard();
    const d2 = dealCard();

    setPlayerHand([p1, p2]);
    setDealerHand([d1, d2]);
    setPhase("dealing");
  }, [dealCard]);

  const doHit = useCallback(() => {
    const newHand = [...playerHand, dealCard()];
    setPlayerHand(newHand);
    setHitFaceDown(true);
    setPhase("hitAnim");
  }, [playerHand, dealCard]);

  const doStand = useCallback(() => {
    const newDealerHand = [...dealerHand];
    while (dealerShouldHit(newDealerHand)) {
      newDealerHand.push(dealCard());
    }
    setDealerHand(newDealerHand);

    const extraCards = newDealerHand.length - 2;
    const steps = 1 + extraCards * 2;
    setDealerRevealStep(0);
    setDealerMaxStep(steps);
    setPhase("dealerTurn");
  }, [dealerHand, dealCard]);

  const doFreeDouble = useCallback(() => {
    setFreeDoubled(true);
    const newHand = [...playerHand, dealCard()];
    setPlayerHand(newHand);
    setHitFaceDown(true);
    setPhase("hitAnim");
  }, [playerHand, dealCard]);

  const doDoubleDown = useCallback(() => {
    setDoubledDown(true);
    onUpdateBalance(-bet); // deduct extra bet
    const newHand = [...playerHand, dealCard()];
    setPlayerHand(newHand);
    setHitFaceDown(true);
    setPhase("doubleDownAnim");
  }, [playerHand, dealCard, bet, onUpdateBalance]);

  const doDoubleUp = useCallback(() => {
    setDoubledUp(true);
    onUpdateBalance(-bet); // deduct the double up amount
    const newHand = [...playerHand, dealCard()];
    setPlayerHand(newHand);
    setHitFaceDown(true);
    setPhase("hitAnim");
  }, [playerHand, dealCard, bet, onUpdateBalance]);

  useInput((input, key) => {
    if (phase === "insurance") {
      if (input === "y") {
        const ins = Math.floor(bet / 2);
        setInsuranceBet(ins);
        onUpdateBalance(-ins);
        // Small delay then proceed
        setTimeout(() => afterInsurance(), 300);
      }
      if (input === "n") {
        afterInsurance();
      }
    }
    if (phase === "playing") {
      const noDoubleYet = !freeDoubled && !doubledDown && !doubledUp;
      if (input === "h" && noDoubleYet) doHit();
      if (input === "s" && noDoubleYet) doStand();
      if (input === "d" && noDoubleYet && canFreeDouble(playerHand)) doFreeDouble();
      if (input === "x" && noDoubleYet && canDoubleDown(playerHand, balance, bet)) doDoubleDown();
      if (input === "u" && noDoubleYet && balance >= bet) doDoubleUp();
      if (input === "r" && noDoubleYet && canSurrender(playerHand)) finishHand("Surrender", -bet * 0.5);
      if (input === "q") onQuit();
    }
    if (phase === "result") {
      if (key.return) setPhase("betting");
      if (input === "q") onQuit();
    }
  });

  // --- Rendering helpers ---

  function playerVisible(): number {
    if (phase === "dealing") {
      if (dealStep >= 5) return 2;
      if (dealStep >= 1) return 1;
      return 0;
    }
    return playerHand.length;
  }

  function playerFaceDown(): Set<number> {
    const s = new Set<number>();
    if (phase === "dealing") {
      if (dealStep >= 1 && dealStep < 2) s.add(0);
      if (dealStep >= 5 && dealStep < 6) s.add(1);
    }
    if ((phase === "hitAnim" || phase === "doubleDownAnim") && hitFaceDown) {
      s.add(playerHand.length - 1);
    }
    return s;
  }

  function dealerVisible(): number {
    if (phase === "dealing") {
      if (dealStep >= 7) return 2;
      if (dealStep >= 3) return 1;
      return 0;
    }
    if (phase === "dealerTurn") {
      if (dealerRevealStep <= 1) return 2;
      const extraRevealed = Math.ceil((dealerRevealStep - 1) / 2);
      return Math.min(2 + extraRevealed, dealerHand.length);
    }
    return dealerHand.length;
  }

  function dealerFaceDown(): Set<number> {
    const s = new Set<number>();
    if (phase === "dealing") {
      if (dealStep >= 3 && dealStep < 4) s.add(0);
      s.add(1); // hole card always down during deal
    }
    if (phase === "insurance" || phase === "playing" || phase === "hitAnim" || phase === "doubleDownAnim") {
      s.add(1); // hole card stays down
    }
    if (phase === "dealerTurn") {
      // Step 0: hole card (index 1) still face-down
      // Step 1: hole card flips face-up
      // Step 2: extra card at index 2 placed face-down
      // Step 3: extra card at index 2 flips face-up
      // Step 4: extra card at index 3 placed face-down
      // etc.
      if (dealerRevealStep < 1) s.add(1); // hole not yet flipped

      // How many extra cards have been fully revealed (flipped face-up)
      const fullyRevealedExtras = dealerRevealStep <= 1 ? 0 : Math.floor((dealerRevealStep - 1 + 1) / 2);
      const firstUnrevealedIdx = 2 + fullyRevealedExtras;

      // Mark all not-yet-revealed extra cards as face-down
      for (let i = firstUnrevealedIdx; i < dealerHand.length; i++) {
        s.add(i);
      }

      // If current step is a "place" step (even, > 1), that card is also face-down
      // (already covered by the loop above since it's >= firstUnrevealedIdx)
    }
    return s;
  }

  const dFD = dealerFaceDown();
  const dVis = dealerVisible();
  const showDealerValue = phase === "result" || phase === "dealerTurn";
  const pFD = playerFaceDown();
  const showPlayerValue = pFD.size === 0;

  // --- Betting screen ---
  if (phase === "betting") {
    return (
      <Box flexDirection="column">
        <Box justifyContent="space-between">
          <Text bold color="cyan">FREE DOUBLE BLACKJACK</Text>
          <Text color="green" bold>${balance.toLocaleString()}</Text>
        </Box>
        <Box marginTop={1} justifyContent="center">
          <BetPicker balance={balance} lastBet={lastBet} onConfirm={startHand} onQuit={onQuit} />
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
          {showDealerValue && <Text dimColor>[{handValue(dealerHand.slice(0, dVis).filter((_, i) => !dFD.has(i)))}]</Text>}
        </Box>
        <HandDisplay
          cards={dealerHand}
          visibleCount={dealerVisible()}
          faceDownSet={dealerFaceDown()}
        />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text dimColor>You </Text>
          {showPlayerValue && <Text dimColor>[{handValue(playerHand)}]</Text>}
          {canFreeDouble(playerHand) && phase === "playing" && (
            <Text color="yellow" bold>  FREE DOUBLE!</Text>
          )}
          {freeDoubled && <Text color="cyan"> (Free Doubled)</Text>}
          {doubledDown && <Text color="magenta"> (Doubled ${bet * 2})</Text>}
          {doubledUp && <Text color="green"> (Double Up)</Text>}
        </Box>
        <HandDisplay
          cards={playerHand}
          visibleCount={playerVisible()}
          faceDownSet={playerFaceDown()}
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
            {canDoubleDown(playerHand, balance, bet) && !canFreeDouble(playerHand) && (
              <><Text bold color="magenta">[X]</Text><Text color="magenta"> Double (${bet})  </Text></>
            )}
            {canFreeDouble(playerHand) && canDoubleDown(playerHand, balance, bet) && (
              <><Text bold color="magenta">[X]</Text><Text color="magenta"> Paid Double (${bet})  </Text></>
            )}
            {balance >= bet && (
              <><Text bold color="green">[U]</Text><Text color="green"> Double Up (${bet})  </Text></>
            )}
            {canSurrender(playerHand) && (
              <><Text bold>[R]</Text><Text>esign  </Text></>
            )}
            <Text bold>[Q]</Text><Text>uit</Text>
          </Text>
        )}
        {(phase === "dealing" || phase === "hitAnim" || phase === "dealerTurn" || phase === "doubleDownAnim") && (
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
