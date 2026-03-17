import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { HandDisplay } from "./Card.js";
import { ChipBar } from "./ChipBar.js";
import { BetPicker } from "./BetPicker.js";
import { createShoe, deal, shouldReshuffle, type Shoe, type Card } from "../engine/deck.js";
import {
  baccaratHandTotal, isNatural, playerDrawsThird,
  bankerDrawsThird, resolveBaccarat, calculateBaccaratPayout,
  type BaccaratBet,
} from "../engine/baccarat.js";
import { loadHistory, saveHistory, addResult, type BaccaratHistoryEntry } from "../engine/history.js";
import { BigRoad } from "./BigRoad.js";
import { loadSettings, saveSettings } from "../settings.js";

/*
 * Three-phase animation:
 *   1. Dealing: 4 initial cards appear face-down rapidly (~100ms each)
 *   2. Revealing: player presses Space to flip cards one by one
 *      Reveal order: player[0], banker[0], player[1], banker[1]
 *   3. After initial 4 revealed, if third card needed:
 *      - Deal third card(s) face-down (dealingThird phase)
 *      - Reveal third card(s) via Space (revealingThird phase)
 *   4. Auto-resolve after all cards revealed
 */

type Phase = "betting" | "chooseSide" | "dealing" | "revealing" | "dealingThird" | "revealingThird" | "result";

const DEAL_DELAY = 100; // fast face-down placement

interface BaccaratProps {
  balance: number;
  onUpdateBalance: (delta: number, handComplete?: boolean) => void;
  onQuit: () => void;
}

export function Baccarat({ balance, onUpdateBalance, onQuit }: BaccaratProps) {
  const [shoe] = useState<Shoe>(() => createShoe());
  const [phase, setPhase] = useState<Phase>("betting");
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [bankerHand, setBankerHand] = useState<Card[]>([]);
  const [bet, setBet] = useState(0);
  const [lastBet, setLastBet] = useState<number | undefined>();
  const [betSide, setBetSide] = useState<BaccaratBet>("player");
  const [result, setResult] = useState("");
  const [payout, setPayout] = useState(0);
  const [history, setHistory] = useState<BaccaratHistoryEntry[]>(() => loadHistory());
  const [chips, setChips] = useState(() => loadSettings().chips);

  const recordResult = useCallback((winner: "player" | "banker" | "tie") => {
    setHistory(prev => {
      const next = addResult(prev, winner);
      saveHistory(next);
      return next;
    });
  }, []);

  // Animation
  const [dealStep, setDealStep] = useState(0); // cards placed face-down (initial 4)
  const [revealStep, setRevealStep] = useState(0); // cards flipped face-up (initial 4)
  const [thirdDealStep, setThirdDealStep] = useState(0); // third cards placed face-down
  const [thirdRevealStep, setThirdRevealStep] = useState(0); // third cards flipped
  const [thirdCardCount, setThirdCardCount] = useState(0); // how many third cards to deal

  const dealCard = useCallback((): Card => {
    if (shouldReshuffle(shoe)) {
      const newShoe = createShoe();
      shoe.cards = newShoe.cards;
      shoe.totalCards = newShoe.totalCards;
    }
    return deal(shoe);
  }, [shoe]);

  const playRound = useCallback((side: BaccaratBet) => {
    setBetSide(side);
    onUpdateBalance(-bet);

    // Only deal initial 2 cards each
    const pHand = [dealCard(), dealCard()];
    const bHand = [dealCard(), dealCard()];

    setPlayerHand(pHand);
    setBankerHand(bHand);
    setDealStep(0);
    setRevealStep(0);
    setThirdDealStep(0);
    setThirdRevealStep(0);
    setThirdCardCount(0);
    setPhase("dealing");
  }, [shoe, dealCard, bet, onUpdateBalance]);

  // After initial 4 revealed, check if third cards are needed
  const checkThirdCards = useCallback(() => {
    const pTotal = baccaratHandTotal(playerHand);
    const bTotal = baccaratHandTotal(bankerHand);

    if (isNatural(pTotal) || isNatural(bTotal)) {
      // Natural — resolve immediately
      const r = resolveBaccarat(pTotal, bTotal);
      const p = calculateBaccaratPayout(bet, betSide, r, bTotal);
      setResult(r === "player" ? "Player Wins!" : r === "banker" ? "Banker Wins!" : "Tie!");
      setPayout(p);
      onUpdateBalance(bet + p, true);
      recordResult(r);
      setPhase("result");
      return;
    }

    const newPHand = [...playerHand];
    const newBHand = [...bankerHand];
    let thirdCount = 0;

    if (playerDrawsThird(pTotal)) {
      const pThird = dealCard();
      newPHand.push(pThird);
      thirdCount++;

      if (bankerDrawsThird(bTotal, pThird)) {
        newBHand.push(dealCard());
        thirdCount++;
      }
    } else {
      if (bTotal <= 5) {
        newBHand.push(dealCard());
        thirdCount++;
      }
    }

    if (thirdCount > 0) {
      setPlayerHand(newPHand);
      setBankerHand(newBHand);
      setThirdCardCount(thirdCount);
      setThirdDealStep(0);
      setThirdRevealStep(0);
      setPhase("dealingThird");
    } else {
      // No third cards needed — resolve
      const r = resolveBaccarat(pTotal, bTotal);
      const p = calculateBaccaratPayout(bet, betSide, r, bTotal);
      setResult(r === "player" ? "Player Wins!" : r === "banker" ? "Banker Wins!" : "Tie!");
      setPayout(p);
      onUpdateBalance(bet + p, true);
      recordResult(r);
      setPhase("result");
    }
  }, [playerHand, bankerHand, bet, betSide, dealCard, onUpdateBalance]);

  // --- Deal animation: place initial 4 cards face-down ---
  useEffect(() => {
    if (phase !== "dealing") return;
    if (dealStep >= 4) {
      setPhase("revealing");
      return;
    }

    const timer = setTimeout(() => setDealStep((s) => s + 1), DEAL_DELAY);
    return () => clearTimeout(timer);
  }, [phase, dealStep]);

  // --- After initial 4 revealed, transition to third cards ---
  useEffect(() => {
    if (phase !== "revealing") return;
    if (revealStep >= 4) {
      const timer = setTimeout(() => checkThirdCards(), 500);
      return () => clearTimeout(timer);
    }
  }, [phase, revealStep, checkThirdCards]);

  // --- Deal third cards face-down ---
  useEffect(() => {
    if (phase !== "dealingThird") return;
    if (thirdDealStep >= thirdCardCount) {
      setPhase("revealingThird");
      return;
    }

    const timer = setTimeout(() => setThirdDealStep((s) => s + 1), DEAL_DELAY);
    return () => clearTimeout(timer);
  }, [phase, thirdDealStep, thirdCardCount]);

  // --- Auto-resolve after all third cards revealed ---
  useEffect(() => {
    if (phase !== "revealingThird") return;
    if (thirdRevealStep >= thirdCardCount) {
      const timer = setTimeout(() => {
        const pTotal = baccaratHandTotal(playerHand);
        const bTotal = baccaratHandTotal(bankerHand);
        const r = resolveBaccarat(pTotal, bTotal);
        const p = calculateBaccaratPayout(bet, betSide, r, bTotal);
        setResult(r === "player" ? "Player Wins!" : r === "banker" ? "Banker Wins!" : "Tie!");
        setPayout(p);
        onUpdateBalance(bet + p, true);
        recordResult(r);
        setPhase("result");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [phase, thirdRevealStep, thirdCardCount, playerHand, bankerHand, bet, betSide, onUpdateBalance]);

  useInput((input, key) => {
    if (phase === "chooseSide") {
      if (input === "p") playRound("player");
      if (input === "b") playRound("banker");
      if (input === "q") onQuit();
    }
    if (phase === "revealing") {
      if (input === " " || key.return) {
        setRevealStep((s) => Math.min(s + 1, 4));
      }
      if (input === "q") onQuit();
    }
    if (phase === "revealingThird") {
      if (input === " " || key.return) {
        setThirdRevealStep((s) => Math.min(s + 1, thirdCardCount));
      }
      if (input === "q") onQuit();
    }
    if (phase === "result") {
      if (key.return) setPhase("betting");
      if (input === "q") onQuit();
    }
  });

  // --- Rendering helpers ---

  function getHandVisibility(hand: Card[], isPlayer: boolean): { visible: number; faceDown: Set<number> } {
    const fd = new Set<number>();

    if (phase === "dealing") {
      // Initial deal: p[0], b[0], p[1], b[1]
      let visible = 0;
      for (let ci = 0; ci < 2; ci++) {
        const dealPos = isPlayer ? ci * 2 : ci * 2 + 1;
        if (dealStep > dealPos) {
          visible = ci + 1;
          fd.add(ci); // all face-down during dealing
        }
      }
      return { visible, faceDown: fd };
    }

    if (phase === "revealing") {
      // All 2 initial cards visible, reveal via Space
      const visible = 2;
      for (let ci = 0; ci < 2; ci++) {
        const revealPos = isPlayer ? ci * 2 : ci * 2 + 1;
        if (revealStep <= revealPos) {
          fd.add(ci);
        }
      }
      return { visible, faceDown: fd };
    }

    if (phase === "dealingThird") {
      // Initial 2 cards face-up, third card being dealt face-down
      const hasThird = hand.length > 2;
      if (!hasThird) return { visible: 2, faceDown: fd };

      // Figure out if this hand's third card has been placed yet
      // Deal order for thirds: player third first (if exists), then banker third
      const playerHasThird = playerHand.length > 2;
      let thirdDealPos: number;
      if (isPlayer) {
        thirdDealPos = 0;
      } else {
        thirdDealPos = playerHasThird ? 1 : 0;
      }

      if (thirdDealStep > thirdDealPos) {
        fd.add(2); // third card face-down
        return { visible: 3, faceDown: fd };
      }
      return { visible: 2, faceDown: fd };
    }

    if (phase === "revealingThird") {
      const hasThird = hand.length > 2;
      if (!hasThird) return { visible: 2, faceDown: fd };

      // Third card visible, check if revealed
      const playerHasThird = playerHand.length > 2;
      let thirdRevealPos: number;
      if (isPlayer) {
        thirdRevealPos = 0;
      } else {
        thirdRevealPos = playerHasThird ? 1 : 0;
      }

      if (thirdRevealStep <= thirdRevealPos) {
        fd.add(2); // not yet revealed
      }
      return { visible: 3, faceDown: fd };
    }

    // result: all face-up
    return { visible: hand.length, faceDown: fd };
  }

  // --- Betting screen ---
  if (phase === "betting") {
    return (
      <Box flexDirection="column">
        <Box justifyContent="space-between">
          <Text bold color="magenta">BACCARAT</Text>
          <Text color="green" bold>${balance.toLocaleString()}</Text>
        </Box>
        <Box marginTop={1} justifyContent="center">
          <BetPicker
            balance={balance}
            lastBet={lastBet}
            chips={chips}
            onChipsChange={(newChips) => {
              setChips(newChips);
              saveSettings({ ...loadSettings(), chips: newChips });
            }}
            onConfirm={(amount) => {
              setBet(amount);
              setLastBet(amount);
              setPhase("chooseSide");
            }}
            onQuit={onQuit}
          />
        </Box>
      </Box>
    );
  }

  // --- Choose side screen ---
  if (phase === "chooseSide") {
    return (
      <Box flexDirection="column" alignItems="center">
        <ChipBar balance={balance} bet={bet} />
        <Text bold color="yellow">{"\u2500".repeat(44)}</Text>
        <Box marginTop={2} flexDirection="column" alignItems="center">
          <Text bold>Choose your side:</Text>
          <Box marginTop={1}>
            <Text>
              <Text bold color="cyan">[P]</Text><Text>layer  </Text>
              <Text bold color="red">[B]</Text><Text>anker  </Text>
              <Text bold>[Q]</Text><Text>uit</Text>
            </Text>
          </Box>
        </Box>
        <BigRoad entries={history} />
      </Box>
    );
  }

  // --- Game screen (dealing / revealing / dealingThird / revealingThird / result) ---
  const pVis = getHandVisibility(playerHand, true);
  const bVis = getHandVisibility(bankerHand, false);
  // Show score based on revealed (face-up) cards only
  const pVisibleSet = new Set(Array.from({ length: pVis.visible }, (_, i) => i).filter(i => !pVis.faceDown.has(i)));
  const bVisibleSet = new Set(Array.from({ length: bVis.visible }, (_, i) => i).filter(i => !bVis.faceDown.has(i)));
  const pRevealedCards = playerHand.filter((_, i) => pVisibleSet.has(i));
  const bRevealedCards = bankerHand.filter((_, i) => bVisibleSet.has(i));
  const showPlayerScore = phase === "result" || pRevealedCards.length > 0;
  const showBankerScore = phase === "result" || bRevealedCards.length > 0;

  const isRevealing = phase === "revealing" || phase === "revealingThird";
  const allRevealed = phase === "revealing" ? revealStep >= 4 : phase === "revealingThird" ? thirdRevealStep >= thirdCardCount : false;

  return (
    <Box flexDirection="column">
      <ChipBar balance={balance} bet={bet} />
      <Text bold color="yellow">{"\u2500".repeat(44)}</Text>

      {/* Player (left) vs Banker (right) */}
      <Box marginTop={1} justifyContent="space-between">
        <Box flexDirection="column">
          <Box>
            <Text bold color="cyan">Player </Text>
            {showPlayerScore && <Text dimColor>[{phase === "result" ? baccaratHandTotal(playerHand) : baccaratHandTotal(pRevealedCards)}]</Text>}
          </Box>
          <HandDisplay
            cards={playerHand.slice(0, pVis.visible)}
            visibleSet={pVisibleSet}
          />
        </Box>

        <Box flexDirection="column" alignItems="flex-end">
          <Box>
            {showBankerScore && <Text dimColor>[{phase === "result" ? baccaratHandTotal(bankerHand) : baccaratHandTotal(bRevealedCards)}] </Text>}
            <Text bold color="red">Banker</Text>
          </Box>
          <HandDisplay
            cards={bankerHand.slice(0, bVis.visible)}
            visibleSet={bVisibleSet}
          />
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Your bet: ${bet} on </Text>
        <Text bold color={betSide === "player" ? "cyan" : betSide === "banker" ? "red" : "yellow"}>
          {betSide.charAt(0).toUpperCase() + betSide.slice(1)}
        </Text>
      </Box>

      <Box marginTop={1}>
        {(phase === "dealing" || phase === "dealingThird") && (
          <Text dimColor>Dealing...</Text>
        )}
        {isRevealing && !allRevealed && (
          <Text>
            <Text bold>[Space]</Text><Text> Reveal next card  </Text>
            <Text bold>[Q]</Text><Text>uit</Text>
          </Text>
        )}
        {isRevealing && allRevealed && (
          <Text dimColor>Resolving...</Text>
        )}
        {phase === "result" && (
          <Box flexDirection="column">
            <Text bold color={payout > 0 ? "green" : payout < 0 ? "red" : "yellow"}>
              {result} {payout > 0 ? `+$${payout}` : payout < 0 ? `-$${Math.abs(payout)}` : ""}
            </Text>
            <Text dimColor>Enter: Next hand  q: Back to lobby</Text>
          </Box>
        )}
      </Box>
      <BigRoad entries={history} />
    </Box>
  );
}
