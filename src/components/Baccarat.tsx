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

/*
 * Two-phase animation:
 *   1. Dealing: cards appear face-down rapidly (~100ms each)
 *   2. Revealing: player presses Space to flip cards one by one
 *      Reveal order: player[0], banker[0], player[1], banker[1], player[2]?, banker[2]?
 */

type Phase = "betting" | "chooseSide" | "dealing" | "revealing" | "result";

const DEAL_DELAY = 100; // fast face-down placement

interface BaccaratProps {
  balance: number;
  onUpdateBalance: (delta: number) => void;
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

  // Animation
  const [dealStep, setDealStep] = useState(0); // cards placed face-down
  const [totalCards, setTotalCards] = useState(0);
  const [revealStep, setRevealStep] = useState(0); // cards flipped face-up

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

    const pHand = [dealCard(), dealCard()];
    const bHand = [dealCard(), dealCard()];

    let pTotal = baccaratHandTotal(pHand);
    let bTotal = baccaratHandTotal(bHand);

    if (!isNatural(pTotal) && !isNatural(bTotal)) {
      if (playerDrawsThird(pTotal)) {
        const pThird = dealCard();
        pHand.push(pThird);
        pTotal = baccaratHandTotal(pHand);

        if (bankerDrawsThird(bTotal, pThird)) {
          bHand.push(dealCard());
          bTotal = baccaratHandTotal(bHand);
        }
      } else {
        if (bTotal <= 5) {
          bHand.push(dealCard());
          bTotal = baccaratHandTotal(bHand);
        }
      }
    }

    setPlayerHand(pHand);
    setBankerHand(bHand);

    const total = pHand.length + bHand.length;
    setTotalCards(total);
    setDealStep(0);
    setRevealStep(0);
    setPhase("dealing");
  }, [shoe, dealCard]);

  // --- Deal animation: place cards face-down rapidly ---
  useEffect(() => {
    if (phase !== "dealing") return;
    if (dealStep >= totalCards) {
      setPhase("revealing");
      return;
    }

    const timer = setTimeout(() => setDealStep((s) => s + 1), DEAL_DELAY);
    return () => clearTimeout(timer);
  }, [phase, dealStep, totalCards]);

  // --- Auto-resolve after all cards revealed ---
  useEffect(() => {
    if (phase !== "revealing") return;
    if (revealStep >= totalCards) {
      const timer = setTimeout(() => {
        const pTotal = baccaratHandTotal(playerHand);
        const bTotal = baccaratHandTotal(bankerHand);
        const r = resolveBaccarat(pTotal, bTotal);
        const p = calculateBaccaratPayout(bet, betSide, r);
        setResult(r === "player" ? "Player Wins!" : r === "banker" ? "Banker Wins!" : "Tie!");
        setPayout(p);
        onUpdateBalance(p);
        setPhase("result");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [phase, revealStep, totalCards, playerHand, bankerHand, bet, betSide, onUpdateBalance]);

  useInput((input, key) => {
    if (phase === "chooseSide") {
      if (input === "p") playRound("player");
      if (input === "b") playRound("banker");
      if (input === "t") playRound("tie");
      if (input === "q") onQuit();
    }
    if (phase === "revealing") {
      if (input === " " || key.return) {
        setRevealStep((s) => Math.min(s + 1, totalCards));
      }
      if (input === "q") onQuit();
    }
    if (phase === "result") {
      if (key.return) setPhase("betting");
      if (input === "q") onQuit();
    }
  });

  // --- Rendering helpers ---
  // Reveal order: interleaved — player[0], banker[0], player[1], banker[1], player[2]?, banker[2]?
  // revealStep 0 = nothing revealed, 1 = first card, etc.

  function getRevealIndex(step: number): { side: "player" | "banker"; cardIdx: number } {
    // Interleave: 0->p[0], 1->b[0], 2->p[1], 3->b[1], 4->p[2], 5->b[2]
    const side = step % 2 === 0 ? "player" : "banker";
    const cardIdx = Math.floor(step / 2);
    return { side, cardIdx };
  }

  function getHandVisibility(hand: Card[], isPlayer: boolean): { visible: number; faceDown: Set<number> } {
    const fd = new Set<number>();

    if (phase === "dealing") {
      // Count how many cards of this hand have been placed
      // Deal order: p[0], b[0], p[1], b[1], p[2]?, b[2]?
      let visible = 0;
      for (let ci = 0; ci < hand.length; ci++) {
        let dealPos: number;
        if (ci < 2) {
          dealPos = isPlayer ? ci * 2 : ci * 2 + 1;
        } else {
          dealPos = 4 + (isPlayer ? 0 : (playerHand.length > 2 ? 1 : 0));
        }
        if (dealStep > dealPos) {
          visible = ci + 1;
          fd.add(ci); // all face-down during dealing
        }
      }
      return { visible, faceDown: fd };
    }

    if (phase === "revealing") {
      // All cards visible (placed), but only revealed ones are face-up
      const visible = hand.length;
      for (let ci = 0; ci < hand.length; ci++) {
        // Find which revealStep reveals this card
        let revealPos: number;
        if (ci < 2) {
          revealPos = isPlayer ? ci * 2 : ci * 2 + 1;
        } else {
          revealPos = 4 + (isPlayer ? 0 : (playerHand.length > 2 ? 1 : 0));
        }
        if (revealStep <= revealPos) {
          fd.add(ci); // not yet revealed
        }
      }
      return { visible, faceDown: fd };
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
              <Text bold color="yellow">[T]</Text><Text>ie  </Text>
              <Text bold>[Q]</Text><Text>uit</Text>
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // --- Game screen (dealing / revealing / result) ---
  const pVis = getHandVisibility(playerHand, true);
  const bVis = getHandVisibility(bankerHand, false);
  const showPlayerScore = phase === "result" || (phase === "revealing" && pVis.faceDown.size === 0);
  const showBankerScore = phase === "result" || (phase === "revealing" && bVis.faceDown.size === 0);

  return (
    <Box flexDirection="column">
      <ChipBar balance={balance} bet={bet} />
      <Text bold color="yellow">{"\u2500".repeat(44)}</Text>

      {/* Player (left) vs Banker (right) */}
      <Box marginTop={1} justifyContent="space-between">
        <Box flexDirection="column">
          <Box>
            <Text bold color="cyan">Player </Text>
            {showPlayerScore && <Text dimColor>[{baccaratHandTotal(playerHand)}]</Text>}
          </Box>
          <HandDisplay
            cards={playerHand}
            visibleCount={pVis.visible}
            faceDownSet={pVis.faceDown}
          />
        </Box>

        <Box flexDirection="column" alignItems="flex-end">
          <Box>
            {showBankerScore && <Text dimColor>[{baccaratHandTotal(bankerHand)}] </Text>}
            <Text bold color="red">Banker</Text>
          </Box>
          <HandDisplay
            cards={bankerHand}
            visibleCount={bVis.visible}
            faceDownSet={bVis.faceDown}
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
        {phase === "dealing" && (
          <Text dimColor>Dealing...</Text>
        )}
        {phase === "revealing" && revealStep < totalCards && (
          <Text>
            <Text bold>[Space]</Text><Text> Reveal next card  </Text>
            <Text bold>[Q]</Text><Text>uit</Text>
          </Text>
        )}
        {phase === "revealing" && revealStep >= totalCards && (
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
    </Box>
  );
}
