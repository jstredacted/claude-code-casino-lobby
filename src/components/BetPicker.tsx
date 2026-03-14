import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

const CHIPS = [10, 25, 50, 100];

interface BetPickerProps {
  balance: number;
  lastBet?: number;
  onConfirm: (amount: number) => void;
  onQuit: () => void;
}

function ChipToken({ value, selected, disabled }: { value: number; selected: boolean; disabled: boolean }) {
  const color = disabled ? "gray" : selected ? "yellow" : "white";
  return (
    <Box flexDirection="column" alignItems="center" marginRight={2}>
      <Text color={color} bold={selected}>
        {selected ? "\u250C\u2500\u2500\u2500\u2500\u2510" : "      "}
      </Text>
      <Text color={color} bold={selected} inverse={selected}>
        {` $${value} `}{value < 100 ? " " : ""}
      </Text>
      <Text color={color} bold={selected}>
        {selected ? "\u2514\u2500\u2500\u2500\u2500\u2518" : "      "}
      </Text>
    </Box>
  );
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
    if (key.leftArrow) setSelectedChip((p) => Math.max(0, p - 1));
    if (key.rightArrow) setSelectedChip((p) => Math.min(CHIPS.length - 1, p + 1));
    if (key.return) {
      const bet = CHIPS[selectedChip];
      if (bet <= balance) onConfirm(bet);
    }
  });

  return (
    <Box flexDirection="column" alignItems="center">
      <Text bold>Place Your Bet</Text>
      <Box marginTop={1}>
        {CHIPS.map((chip, i) => (
          <ChipToken key={chip} value={chip} selected={i === selectedChip} disabled={chip > balance} />
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{"\u2190\u2192"} Select   Enter: Confirm   q: Back</Text>
      </Box>
    </Box>
  );
}
