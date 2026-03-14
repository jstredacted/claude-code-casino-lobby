import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

const CHIPS = [10, 25, 50, 100];
const MIN_BET = 10;
const MAX_BET = 500;

interface BetPickerProps {
  balance: number;
  lastBet?: number;
  onConfirm: (amount: number) => void;
  onQuit: () => void;
}

export function BetPicker({ balance, lastBet, onConfirm, onQuit }: BetPickerProps) {
  const [selectedChip, setSelectedChip] = useState(() => {
    if (lastBet) {
      const idx = CHIPS.indexOf(lastBet);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  useInput((input, key) => {
    if (input === "q") {
      onQuit();
      return;
    }
    if (key.leftArrow) {
      setSelectedChip((prev) => Math.max(0, prev - 1));
    }
    if (key.rightArrow) {
      setSelectedChip((prev) => Math.min(CHIPS.length - 1, prev + 1));
    }
    if (key.return) {
      const bet = CHIPS[selectedChip];
      if (bet <= balance && bet >= MIN_BET && bet <= MAX_BET) {
        onConfirm(bet);
      }
    }
  });

  return (
    <Box flexDirection="column" alignItems="center">
      <Text bold>Place Your Bet</Text>
      <Text dimColor>Balance: ${balance.toLocaleString()}</Text>
      <Box marginTop={1}>
        {CHIPS.map((chip, i) => (
          <Box key={chip} marginRight={2}>
            <Text
              bold={i === selectedChip}
              color={i === selectedChip ? "yellow" : chip > balance ? "gray" : "white"}
              inverse={i === selectedChip}
            >
              {" "}${chip}{" "}
            </Text>
          </Box>
        ))}
      </Box>
      <Text dimColor marginTop={1}>
        {"<-/-> Select   Enter: Confirm   q: Back"}
      </Text>
    </Box>
  );
}
