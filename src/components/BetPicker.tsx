import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

const CHIPS = [10, 25, 50, 100];
const MIN_BET = 1;
const MAX_BET = 999999;

interface BetPickerProps {
  balance: number;
  lastBet?: number;
  onConfirm: (amount: number) => void;
  onQuit: () => void;
}

type Mode = "chips" | "manual";

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
  const [mode, setMode] = useState<Mode>("chips");
  const [selectedChip, setSelectedChip] = useState(() => {
    if (lastBet) {
      const idx = CHIPS.indexOf(lastBet);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const [manualInput, setManualInput] = useState("");

  useInput((input, key) => {
    if (input === "q") {
      onQuit();
      return;
    }

    if (mode === "chips") {
      if (key.leftArrow) setSelectedChip((p) => Math.max(0, p - 1));
      if (key.rightArrow) setSelectedChip((p) => Math.min(CHIPS.length - 1, p + 1));
      if (key.return) {
        const bet = CHIPS[selectedChip];
        if (bet <= balance) onConfirm(bet);
      }
      if (input === "m") {
        setManualInput("");
        setMode("manual");
      }
      if (input === "a") {
        if (balance >= MIN_BET) onConfirm(balance);
      }
    } else if (mode === "manual") {
      if (key.return) {
        const amount = parseInt(manualInput);
        if (amount >= MIN_BET && amount <= MAX_BET && amount <= balance) {
          onConfirm(amount);
        }
        return;
      }
      if (key.escape) {
        setMode("chips");
        return;
      }
      if (key.backspace || key.delete) {
        setManualInput((p) => p.slice(0, -1));
        return;
      }
      if (/^[0-9]$/.test(input) && manualInput.length < 7) {
        setManualInput((p) => p + input);
      }
    }
  });

  const manualAmount = parseInt(manualInput) || 0;
  const manualValid = manualAmount >= MIN_BET && manualAmount <= MAX_BET && manualAmount <= balance;

  return (
    <Box flexDirection="column" alignItems="center">
      <Text bold>Place Your Bet</Text>
      {mode === "chips" ? (
        <>
          <Box marginTop={1}>
            {CHIPS.map((chip, i) => (
              <ChipToken key={chip} value={chip} selected={i === selectedChip} disabled={chip > balance} />
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>{"\u2190\u2192"} Select   Enter: Confirm   [M] Manual   [A] All In (${balance.toLocaleString()})   q: Back</Text>
          </Box>
        </>
      ) : (
        <>
          <Box marginTop={1} flexDirection="column" alignItems="center">
            <Box>
              <Text dimColor>Amount: $</Text>
              <Text bold color={manualValid ? "green" : manualInput.length > 0 ? "red" : "white"}>
                {manualInput || "_"}
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>
                ${MIN_BET}–${balance.toLocaleString()} (balance: ${balance.toLocaleString()})
              </Text>
            </Box>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Type amount   Enter: Confirm   Esc: Back to chips   q: Quit</Text>
          </Box>
        </>
      )}
    </Box>
  );
}
