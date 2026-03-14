import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { HandDisplay } from "./Card.js";
import { ChipBar } from "./ChipBar.js";
import { BetPicker } from "./BetPicker.js";
import { createShoe, deal, shouldReshuffle, type Shoe, type Card } from "../engine/deck.js";
import {
  handValue, isBlackjack, isBust, canFreeDouble, canSurrender,
  dealerShouldHit, resolveHand, calculatePayout,
} from "../engine/blackjack.js";

type Phase = "betting" | "playing" | "result";

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
  const [result, setResult] = useState("");
  const [payout, setPayout] = useState(0);

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

  const runDealer = useCallback((dHand: Card[], pHand: Card[], currentBet: number, wasFreeDoubled: boolean) => {
    const newDealerHand = [...dHand];
    while (dealerShouldHit(newDealerHand)) {
      newDealerHand.push(dealCard());
    }
    setDealerHand(newDealerHand);

    const r = resolveHand(handValue(pHand), handValue(newDealerHand), false, false);
    const p = calculatePayout(currentBet, r, wasFreeDoubled);
    const label = r === "win" ? "You Win!" : r === "lose" ? "Dealer Wins" : "Push";
    finishHand(label, p);
  }, [dealCard, finishHand]);

  const startHand = useCallback((betAmount: number) => {
    setBet(betAmount);
    setLastBet(betAmount);
    setFreeDoubled(false);
    setResult("");
    setPayout(0);

    const p1 = dealCard();
    const d1 = dealCard();
    const p2 = dealCard();
    const d2 = dealCard();

    setPlayerHand([p1, p2]);
    setDealerHand([d1, d2]);

    if (isBlackjack([p1, p2]) || isBlackjack([d1, d2])) {
      const r = resolveHand(handValue([p1, p2]), handValue([d1, d2]), isBlackjack([p1, p2]), isBlackjack([d1, d2]));
      const p = calculatePayout(betAmount, r, false);
      const label = r === "blackjack" ? "BLACKJACK!" : r === "push" ? "Push" : "Dealer Blackjack";
      finishHand(label, p);
      return;
    }

    setPhase("playing");
  }, [dealCard, finishHand]);

  useInput((input, key) => {
    if (phase === "playing") {
      if (input === "h") {
        const newHand = [...playerHand, dealCard()];
        setPlayerHand(newHand);
        if (isBust(newHand)) {
          finishHand("Bust!", calculatePayout(bet, "bust", freeDoubled));
        }
      }
      if (input === "s") {
        runDealer(dealerHand, playerHand, bet, freeDoubled);
      }
      if (input === "d" && canFreeDouble(playerHand)) {
        setFreeDoubled(true);
        const newHand = [...playerHand, dealCard()];
        setPlayerHand(newHand);
        if (isBust(newHand)) {
          finishHand("Bust!", calculatePayout(bet, "bust", true));
        } else {
          runDealer(dealerHand, newHand, bet, true);
        }
      }
      if (input === "r" && canSurrender(playerHand)) {
        finishHand("Surrender", -bet * 0.5);
      }
      if (input === "q") onQuit();
    }
    if (phase === "result") {
      if (key.return) setPhase("betting");
      if (input === "q") onQuit();
    }
  });

  if (phase === "betting") {
    return (
      <Box flexDirection="column">
        <Box justifyContent="space-between">
          <Text bold>FREE DOUBLE BLACKJACK</Text>
          <Text color="green" bold>${balance.toLocaleString()}</Text>
        </Box>
        <Box marginTop={1} justifyContent="center">
          <BetPicker balance={balance} lastBet={lastBet} onConfirm={startHand} onQuit={onQuit} />
        </Box>
      </Box>
    );
  }

  const showDealerHole = phase === "result";

  return (
    <Box flexDirection="column">
      <ChipBar balance={balance} bet={bet} />
      <Text bold dimColor>{"─".repeat(42)}</Text>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Dealer:</Text>
        <Box>
          <Text>  </Text>
          {showDealerHole ? (
            <HandDisplay cards={dealerHand} />
          ) : (
            <>
              <HandDisplay cards={[dealerHand[0]]} hidden={true} />
              <Text>  </Text>
              <HandDisplay cards={dealerHand.slice(1)} />
            </>
          )}
        </Box>
        {showDealerHole && (
          <Text dimColor>  Value: {handValue(dealerHand)}</Text>
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>You:</Text>
        <Box>
          <Text>  </Text>
          <HandDisplay cards={playerHand} />
        </Box>
        <Box>
          <Text dimColor>  Value: {handValue(playerHand)}</Text>
          {canFreeDouble(playerHand) && phase === "playing" && (
            <Text color="yellow" bold>  ** FREE DOUBLE! **</Text>
          )}
          {freeDoubled && <Text color="cyan"> (Doubled)</Text>}
        </Box>
      </Box>

      <Box marginTop={1}>
        {phase === "playing" && (
          <Text>
            <Text bold>[H]</Text><Text>it  </Text>
            <Text bold>[S]</Text><Text>tand  </Text>
            {canFreeDouble(playerHand) && (
              <><Text bold color="yellow">[D]</Text><Text color="yellow">ouble (FREE!)  </Text></>
            )}
            {canSurrender(playerHand) && (
              <><Text bold>[R]</Text><Text>esign  </Text></>
            )}
            <Text bold>[Q]</Text><Text>uit</Text>
          </Text>
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
