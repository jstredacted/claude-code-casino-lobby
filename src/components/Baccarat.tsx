import React, { useState, useCallback } from "react";
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

type Phase = "betting" | "chooseSide" | "result";

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

    const r = resolveBaccarat(pTotal, bTotal);
    const p = calculateBaccaratPayout(bet, side, r);
    setResult(r === "player" ? "Player Wins!" : r === "banker" ? "Banker Wins!" : "Tie!");
    setPayout(p);
    onUpdateBalance(p);
    setPhase("result");
  }, [shoe, bet, dealCard, onUpdateBalance]);

  useInput((input, key) => {
    if (phase === "chooseSide") {
      if (input === "p") playRound("player");
      if (input === "b") playRound("banker");
      if (input === "t") playRound("tie");
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
          <Text bold>BACCARAT</Text>
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

  if (phase === "chooseSide") {
    return (
      <Box flexDirection="column" alignItems="center">
        <ChipBar balance={balance} bet={bet} />
        <Text bold dimColor>{"─".repeat(42)}</Text>
        <Box marginTop={2}>
          <Text>
            <Text bold>[P]</Text><Text>layer  </Text>
            <Text bold>[B]</Text><Text>anker  </Text>
            <Text bold>[T]</Text><Text>ie  </Text>
            <Text bold>[Q]</Text><Text>uit</Text>
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <ChipBar balance={balance} bet={bet} />
      <Text bold dimColor>{"─".repeat(42)}</Text>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Player:</Text>
        <Box>
          <Text>  </Text>
          <HandDisplay cards={playerHand} />
          <Text>  | </Text>
          <Text bold>{baccaratHandTotal(playerHand)}</Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Banker:</Text>
        <Box>
          <Text>  </Text>
          <HandDisplay cards={bankerHand} />
          <Text>  | </Text>
          <Text bold>{baccaratHandTotal(bankerHand)}</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Your bet: ${bet} on </Text>
        <Text bold color="cyan">{betSide.charAt(0).toUpperCase() + betSide.slice(1)}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color={payout > 0 ? "green" : payout < 0 ? "red" : "yellow"}>
          {result} {payout > 0 ? `+$${payout}` : payout < 0 ? `-$${Math.abs(payout)}` : ""}
        </Text>
        <Text dimColor>Enter: Next hand  q: Back to lobby</Text>
      </Box>
    </Box>
  );
}
